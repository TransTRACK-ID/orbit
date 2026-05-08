import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { changePasswordSchema } from '~/server/utils/validation'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = getDb()
  const body = await readValidatedBody(event, changePasswordSchema.parse)

  // Verify current password
  const dbUser = await db.query.users.findFirst({
    where: eq(schema.users.id, user.id),
  })

  if (!dbUser) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const isValid = await bcrypt.compare(body.currentPassword, dbUser.passwordHash)
  if (!isValid) {
    throw createError({ statusCode: 400, statusMessage: 'Current password is incorrect' })
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(body.newPassword, 10)

  await db
    .update(schema.users)
    .set({ passwordHash })
    .where(eq(schema.users.id, user.id))

  return { success: true }
})
