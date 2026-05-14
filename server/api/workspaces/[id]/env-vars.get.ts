import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const workspaceId = getRouterParam(event, 'workspaceId')
  if (!workspaceId) throw createError({ statusCode: 400, statusMessage: 'Missing workspace ID' })

  const db = getDb()

  // Verify user is member of workspace
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(schema.workspaceMembers.workspaceId, workspaceId),
      eq(schema.workspaceMembers.userId, user.id)
    ),
  })
  if (!member) throw createError({ statusCode: 403, statusMessage: 'Not a workspace member' })

  const envVars = await db.query.workspaceEnvVars.findMany({
    where: eq(schema.workspaceEnvVars.workspaceId, workspaceId),
    orderBy: (envVars, { asc }) => [asc(envVars.key)],
  })

  return envVars
})
