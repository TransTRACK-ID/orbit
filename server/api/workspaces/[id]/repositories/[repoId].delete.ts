import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id, repoId } = getRouterParams(event)
  await requireWorkspaceAccess(event, id)
  const db = getDb()

  const [deleted] = await db
    .delete(schema.repositories)
    .where(
      and(
        eq(schema.repositories.id, repoId),
        eq(schema.repositories.workspaceId, id),
      ),
    )
    .returning()

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Repository not found' })
  }

  return { success: true }
})
