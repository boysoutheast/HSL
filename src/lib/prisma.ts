import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Add connection_limit + pool_timeout to DATABASE_URL if not already set.
// Prevents pool exhaustion under load. Railway Postgres max_connections=100.
function buildPrismaOptions(): ConstructorParameters<typeof PrismaClient>[0] {
  const envUrl = process.env.DATABASE_URL ?? ''

  // Only augment if connection_limit not already in URL
  if (!envUrl.includes('connection_limit')) {
    const separator = envUrl.includes('?') ? '&' : '?'
    const enhancedUrl = `${envUrl}${separator}connection_limit=20&pool_timeout=10`
    return {
      datasources: { db: { url: enhancedUrl } },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    }
  }

  return {
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(buildPrismaOptions())

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Clean shutdown — critical for Railway zero-downtime deploys
if (process.env.NODE_ENV === 'production') {
  const shutdown = async () => {
    console.log('[prisma] Shutting down...')
    await globalForPrisma.prisma?.$disconnect()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}
