import { getServerSession } from '#auth'
import { requireSuperAdmin } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { updateUserRoleSchema } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'User ID is required' })
  }

  const session = await getServerSession(event)
  const currentUserId = (session as any)?.user?.id

  const body = await readValidatedBody(event, updateUserRoleSchema.parse)

  // Prevent self-demotion
  if (currentUserId === userId && body.role !== 'super_admin') {
    throw createError({ statusCode: 400, statusMessage: 'You cannot demote yourself' })
  }

  const db = getDb()

  const [updated] = await db
    .update(schema.users)
    .set({ role: body.role })
    .where(eq(schema.users.id, userId))
    .returning({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
    })

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  return updated
})
