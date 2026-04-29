import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id, userId } = getRouterParams(event)
  const { user: currentUser } = await requireWorkspaceAccess(event, id)
  const db = getDb()

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(schema.workspaceMembers.workspaceId, id),
      eq(schema.workspaceMembers.userId, userId)
    ),
  })

  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  }

  // Cannot remove the owner
  if (member.role === 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Cannot remove the workspace owner' })
  }

  await db
    .delete(schema.workspaceMembers)
    .where(and(
      eq(schema.workspaceMembers.workspaceId, id),
      eq(schema.workspaceMembers.userId, userId)
    ))

  return { success: true }
})
