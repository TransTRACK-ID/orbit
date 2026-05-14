import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const workspaceId = getRouterParam(event, 'id')
  const envVarId = getRouterParam(event, 'envVarId')
  if (!workspaceId || !envVarId) throw createError({ statusCode: 400, statusMessage: 'Missing parameters' })

  const db = getDb()

  // Verify user is member of workspace
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(schema.workspaceMembers.workspaceId, workspaceId),
      eq(schema.workspaceMembers.userId, user.id)
    ),
  })
  if (!member) throw createError({ statusCode: 403, statusMessage: 'Not a workspace member' })

  await db.delete(schema.workspaceEnvVars)
    .where(eq(schema.workspaceEnvVars.id, envVarId))

  return { success: true }
})
