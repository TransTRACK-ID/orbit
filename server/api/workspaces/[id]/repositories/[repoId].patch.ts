import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { updateRepositorySchema } from '~/server/utils/validation'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id, repoId } = getRouterParams(event)
  await requireWorkspaceAccess(event, id)
  const body = await readValidatedBody(event, updateRepositorySchema.parse)
  const db = getDb()

  const [updated] = await db
    .update(schema.repositories)
    .set(body)
    .where(
      and(
        eq(schema.repositories.id, repoId),
        eq(schema.repositories.workspaceId, id),
      ),
    )
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Repository not found' })
  }

  return updated
})
