import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

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

  const body = await readBody<{ title: string; repositoryId?: string | null }>(event)

  if (!body.title?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required' })
  }

  const [brainstorm] = await db.insert(schema.brainstorms)
    .values({
      workspaceId: id,
      repositoryId: body.repositoryId || null,
      title: body.title.trim(),
    })
    .returning()

  return brainstorm
})
