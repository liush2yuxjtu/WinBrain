import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'prisma/config'

loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

const fallbackDatabaseUrl = 'postgresql://winbrain:winbrain@127.0.0.1:5432/winbrain?schema=public'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations'
  },
  datasource: {
    url: process.env.DATABASE_URL || fallbackDatabaseUrl
  }
})
