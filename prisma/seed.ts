import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Seed default PostingMonitorSetting
  const existingSettings = await prisma.postingMonitorSetting.findFirst()
  if (!existingSettings) {
    await prisma.postingMonitorSetting.create({
      data: {
        checkIntervalMinutes: 60,
        minimumDecisionAgeMinutes: 180,
        deadEarlyAgeMinutes: 120,
        stuckThresholdPercentPerHour: 3,
        growingThresholdPercentPerHour: 10,
        hotThresholdPercentPerHour: 20,
        stuckConfirmationCount: 2,
        hotLockDurationMinutes: 360,
        maxPostPerDay: 2,
        minimumGapUploadMinutes: 360,
      },
    })
    console.log('Created default PostingMonitorSetting')
  } else {
    console.log('PostingMonitorSetting already exists, skipping')
  }

  // Seed default admin user
  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: 'admin@hermes.local' },
  })

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('hermes123', 12)
    await prisma.adminUser.create({
      data: {
        email: 'admin@hermes.local',
        passwordHash,
        name: 'Hermes Admin',
        role: 'admin',
      },
    })
    console.log('Created admin user: admin@hermes.local / hermes123')
  } else {
    console.log('Admin user already exists, skipping')
  }

  console.log('Seeding complete.')
}

main()
  .catch(e => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
