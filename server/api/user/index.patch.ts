import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { updateUserSchema } from '~/server/utils/validation'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = getDb()
  const body = await readValidatedBody(event, updateUserSchema.parse)

  // If email is being changed, check it's not already taken
  if (body.email && body.email !== user.email) {
    const existing = await db.query.users.findFirst({
      where: eq(schema.users.email, body.email.toLowerCase()),
    })
    if (existing) {
      throw createError({ statusCode: 409, statusMessage: 'Email already in use' })
    }
  }

  const updateData: Record<string, any> = {}
  if (body.name) updateData.name = body.name
  if (body.email) updateData.email = body.email.toLowerCase()

  if (Object.keys(updateData).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  const [updated] = await db
    .update(schema.users)
    .set(updateData)
    .where(eq(schema.users.id, user.id))
    .returning({ id: schema.users.id, name: schema.users.name, email: schema.users.email })

  return updated
})
