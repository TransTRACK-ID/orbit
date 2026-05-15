import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = getDb()

  await db
    .update(schema.users)
    .set({ onboardingCompleted: true })
    .where(eq(schema.users.id, user.id))

  return { success: true }
})
