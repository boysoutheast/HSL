/**
 * S3-topup smoke test: simulate topup pipeline 
 * → claim pool → create ad PAUSED via Meta API → verify ad_id
 */
import { PrismaClient } from '@prisma/client'
import { createAd, resolvePageId } from '@/lib/meta-client'
import { decode } from '@/lib/crypto'
import { notify } from '@/lib/notify'

const prisma = new PrismaClient()

async function main() {
  console.log('=== S3-topup: Create PAUSED Ad via Meta API ===')
  const now = new Date()

  // 1. Get session
  const session = await prisma.campaignSession.findFirst({
    where: { name: 'SMOKE-AFF' },
    select: {
      id: true, userId: true, topupTargetAdsetId: true,
      metaAdAccountId: true, minActiveAds: true,
      metaAdAccount: { select: { id: true, metaAccountId: true, adAccountId: true } },
    }
  })
  if (!session) throw new Error('Session not found')
  const adAccountId = session.metaAdAccount!.adAccountId!.replace('act_', '')
  console.log(`Session: ${session.id}, Ad account: ${adAccountId}`)

  // 2. Get token
  const metaAcct = await prisma.metaAccount.findUnique({
    where: { id: session.metaAdAccount!.metaAccountId },
    select: { longLivedTokenEncrypted: true }
  })
  if (!metaAcct?.longLivedTokenEncrypted) throw new Error('No token')
  const token = decode(metaAcct.longLivedTokenEncrypted)

  // 3. Resolve page ID
  console.log('\n--- Resolving page ID...')
  const pageId = await resolvePageId(adAccountId, token, {
    sessionId: session.id,
    metaAdAccountId: session.metaAdAccount!.id,
  })
  console.log(`Page ID: ${pageId}`)

  // 4. Atomic claim pool item
  console.log('\n--- Claiming pool item...')
  const poolItem = await prisma.campaignCreativePool.findFirst({
    where: { campaignSessionId: session.id, status: 'available' },
    orderBy: { sortOrder: 'asc' },
  })
  if (!poolItem) throw new Error('No available pool item')
  console.log(`Pool item: ${poolItem.id}, headline: "${poolItem.headline}"`)

  // Mark as claimed
  const claimResult = await prisma.campaignCreativePool.updateMany({
    where: { id: poolItem.id, status: 'available' },
    data: { status: 'used', usedAt: new Date() },
  })
  if (claimResult.count === 0) throw new Error('Contention: pool item claimed by another process')
  console.log('✅ Pool item claimed')

  // 5. Create ad via Meta API (PAUSED)
  console.log('\n--- Creating ad (PAUSED)...')
  const adName = `SMOKE-Topup-${poolItem.headline?.slice(0, 20)}-${Date.now()}`
  
  const adResult = await createAd({
    adAccountId,
    pageId,
    name: adName,
    adsetId: session.topupTargetAdsetId ?? '',
    primaryText: poolItem.primaryText ?? '',
    headline: poolItem.headline ?? '',
    description: poolItem.description ?? '',
    callToAction: (poolItem.callToAction ?? 'LEARN_MORE') as any,
    linkUrl: poolItem.linkUrl ?? '',
    mediaUrl: poolItem.creativeUrl ?? undefined,
    status: 'PAUSED',
  }, token)
  
  console.log(`✅ Ad created!`)
  console.log(`   adId: ${adResult.adId}`)
  console.log(`   creativeId: ${adResult.creativeId}`)
  console.log(`   name: ${adName}`)

  // 6. Update pool with Meta ad ID
  await prisma.campaignCreativePool.update({
    where: { id: poolItem.id },
    data: { usedMetaAdId: adResult.adId },
  })
  console.log('✅ Pool updated with Meta ad ID')

  // 7. Create topup log
  await prisma.campaignTopupLog.create({
    data: {
      campaignSessionId: session.id,
      activeAdsBefore: 0,
      minActiveAds: session.minActiveAds,
      poolCreativeId: poolItem.id,
      status: 'succeeded',
      note: `Ad ${adResult.adId} created PAUSED`,
      triggeredAt: now,
    }
  })
  console.log('✅ Topup log created')

  // 8. Create AutomationAction
  await prisma.automationAction.create({
    data: {
      userId: session.userId,
      campaignSessionId: session.id,
      source: 'SYSTEM',
      actionType: 'CREATE_AD',
      payloadJson: JSON.stringify({ adId: adResult.adId, creativeId: adResult.creativeId, poolCreativeId: poolItem.id }),
      status: 'SUCCEEDED',
      idempotencyKey: `smoke-topup_${session.id}_${poolItem.id}`,
      priority: 3,
      requestedAt: now,
      executedAt: now,
      confirmedAt: now,
    }
  })
  console.log('✅ AutomationAction created (CREATE_AD/SUCCEEDED)')

  // 9. Notify
  try {
    await notify(session.userId, {
      type: 'topup_created',
      severity: 'success',
      title: '[SMOKE] Ad baru ditambahkan',
      body: `Ad ${adResult.adId} dibuat (PAUSED) untuk top-up SMOKE-AFF.`,
      refType: 'campaign_session',
      refId: session.id,
    })
    console.log('✅ Notification sent')
  } catch(e: any) {
    console.log('⚠️ Notification error (non-fatal):', e.message?.slice(0, 100))
  }

  console.log('\n=== ✅ S3-TOPUP COMPLETE ===')
  console.log(`Ad ID: ${adResult.adId}`)
  console.log(`Cleanup: DELETE /act_${adAccountId}/ads/${adResult.adId}`)
  
  await prisma.$disconnect()
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
