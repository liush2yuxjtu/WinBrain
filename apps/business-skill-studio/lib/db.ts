import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

const globalForPrisma = globalThis as unknown as {
  winBrainPrisma?: PrismaClient
  winBrainPrismaUrl?: string
}

export function createPrismaClient(databaseUrl: string): PrismaClient {
  if (!databaseUrl.trim()) {
    throw new Error('DATABASE_URL is required when SKILL_STORE_DRIVER=database')
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl })
  return new PrismaClient({ adapter })
}

export function getPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required when SKILL_STORE_DRIVER=database')
  }

  if (globalForPrisma.winBrainPrisma && globalForPrisma.winBrainPrismaUrl !== databaseUrl) {
    throw new Error('DATABASE_URL changed after the Prisma client was initialized')
  }

  if (!globalForPrisma.winBrainPrisma) {
    globalForPrisma.winBrainPrisma = createPrismaClient(databaseUrl)
    globalForPrisma.winBrainPrismaUrl = databaseUrl
  }

  return globalForPrisma.winBrainPrisma
}
