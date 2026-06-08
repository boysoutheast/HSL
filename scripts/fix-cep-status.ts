import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.cep.updateMany({
    where: { status: 'pending_review' },
    data: { status: 'active' },
  })
  console.log(`Updated ${result.count} CEPs from pending_review → active`)

  const total = await prisma.cep.count({ where: { status: 'active' } })
  console.log(`Total active CEPs now: ${total}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
