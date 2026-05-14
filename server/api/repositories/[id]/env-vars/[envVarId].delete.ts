import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const repositoryId = getRouterParam(event, 'id')
  const envVarId = getRouterParam(event, 'envVarId')
  if (!repositoryId || !envVarId) throw createError({ statusCode: 400, statusMessage: 'Missing parameters' })

  const db = getDb()

  // Verify user has access to the repository's workspace
  const repo = await db.query.repositories.findFirst({
    where: eq(schema.repositories.id, repositoryId),
    with: { workspace: true },
  })
  if (!repo) throw createError({ statusCode: 404, statusMessage: 'Repository not found' })

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(schema.workspaceMembers.workspaceId, repo.workspaceId),
      eq(schema.workspaceMembers.userId, user.id)
    ),
  })
  if (!member) throw createError({ statusCode: 403, statusMessage: 'Not a workspace member' })

  await db.delete(schema.repositoryEnvVars)
    .where(eq(schema.repositoryEnvVars.id, envVarId))

  return { success: true }
})
