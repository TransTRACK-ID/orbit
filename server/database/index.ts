import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema'

const { Pool } = pg

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (!_db) {
    const connectionString = process.env.POSTGRES_URL || 'postgres://postgres:postgres@localhost:5432/orbit'
    const pool = new Pool({ connectionString })
    _db = drizzle(pool, { schema })
  }
  return _db
}

export { schema }
