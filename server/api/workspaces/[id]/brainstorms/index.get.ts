import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)
  const db = getDb()

  // Verify workspace membership
  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(schema.workspaceMembers.workspaceId, id),
  })
  if (!membership || membership.userId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const brainstorms = await db.query.brainstorms.findMany({
    where: eq(schema.brainstorms.workspaceId, id),
    orderBy: [desc(schema.brainstorms.createdAt)],
    with: {
      repository: true,
    },
  })

  return brainstorms
})
