import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Find first admin user
  const admin = await prisma.adminUser.findFirst({ where: { role: 'admin' } })
  if (!admin) {
    console.log('No admin user found. Create one first.')
    return
  }

  // Assign all existing data to admin (data created before multi-user)
  const [accounts, products] = await Promise.all([
    prisma.instagramAccount.updateMany({
      where: { createdByUserId: null },
      data: { createdByUserId: admin.id },
    }),
    prisma.product.updateMany({
      where: { createdByUserId: null },
      data: { createdByUserId: admin.id },
    }),
  ])

  console.log(
    `Updated ${accounts.count} accounts, ${products.count} products → owner: ${admin.email} (${admin.id})`,
  )
}

main().catch(console.error).finally(() => prisma.$disconnect())
