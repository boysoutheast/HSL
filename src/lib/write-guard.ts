/**
 * write-guard.ts — Multi-tenant write permission gate.
 *
 * Fail-closed: ragu kepemilikan → JANGAN write.
 */

import { prisma } from '@/lib/prisma'
import { decode } from '@/lib/crypto'

export interface WriteCheckResult {
  ok: boolean
  reason?: string
  token?: string
  adAccountId?: string
}

/**
 * Check if the session's campaign has write permission.
 *
 * Rules (all must pass):
 * 1. Global kill-switch HSL_AUTOMATION_WRITES_ENABLED (default true)
 * 2. Session has metaAdAccountId
 * 3. MetaAdAccount EXISTS and belongs to session.userId (ownership)
 * 4. MetaAccount.status === 'connected'
 * 5. Token not expired (tokenExpiry > now or null)
 * 6. Token exists (longLivedTokenEncrypted)
 */
export async function canWriteToAdAccount(
  sessionUserId: string,
  metaAdAccountId: string | null,
): Promise<WriteCheckResult> {
  // 0. Global kill-switch
  if (process.env.HSL_AUTOMATION_WRITES_ENABLED === 'false') {
    return { ok: false, reason: 'writes_disabled_global' }
  }
  if (!metaAdAccountId) {
    return { ok: false, reason: 'no_ad_account' }
  }

  // 1. Find MetaAdAccount — ownership check (fail-closed: must belong to user)
  const adAccount = await prisma.metaAdAccount.findFirst({
    where: { id: metaAdAccountId },
    select: {
      adAccountId: true,
      metaAccount: {
        select: {
          userId: true,
          longLivedTokenEncrypted: true,
          tokenExpiry: true,
          status: true,
        },
      },
    },
  })

  if (!adAccount) {
    return { ok: false, reason: 'not_found' }
  }

  // 2. Ownership: MetaAccount.userId must match session userId
  if (adAccount.metaAccount.userId !== sessionUserId) {
    return { ok: false, reason: 'not_owned' }
  }

  const meta = adAccount.metaAccount

  // 3. Token exists
  if (!meta.longLivedTokenEncrypted) {
    return { ok: false, reason: 'no_token' }
  }

  // 4. Status check
  if (meta.status !== 'connected') {
    return { ok: false, reason: `account_${meta.status}` }
  }

  // 5. Expiry check
  if (meta.tokenExpiry && meta.tokenExpiry < new Date()) {
    return { ok: false, reason: 'token_expired' }
  }

  // All checks pass — decrypt and return
  try {
    const token = decode(meta.longLivedTokenEncrypted)
    return {
      ok: true,
      token,
      adAccountId: adAccount.adAccountId,
    }
  } catch {
    return { ok: false, reason: 'token_decrypt_failed' }
  }
}

/**
 * Update MetaAccount status and lastTokenCheckAt.
 * Called when a token error is detected during Meta API calls.
 */
export async function markAccountNeedsReconnect(metaAccountId: string): Promise<void> {
  await prisma.metaAccount.update({
    where: { id: metaAccountId },
    data: {
      status: 'needs_reconnect',
      lastTokenCheckAt: new Date(),
    },
  })
}

/**
 * Mark Meta account as active (successful API call).
 */
export async function markAccountHealthy(metaAccountId: string): Promise<void> {
  await prisma.metaAccount.update({
    where: { id: metaAccountId },
    data: {
      lastMetaCallAt: new Date(),
    },
  })
}
