import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/database/schema/*.ts',
  out: './server/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL || 'postgres://postgres:postgres@localhost:5432/orbit',
  },
})
