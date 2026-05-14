import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const workspaceId = getRouterParam(event, 'id')
  if (!workspaceId) throw createError({ statusCode: 400, statusMessage: 'Missing workspace ID' })

  const body = await readBody(event)
  const { key, value } = body

  if (!key || typeof value !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing key or value' })
  }

  const normalizedKey = key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  if (!normalizedKey) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid key name' })
  }

  const db = getDb()

  // Verify user is member of workspace
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(schema.workspaceMembers.workspaceId, workspaceId),
      eq(schema.workspaceMembers.userId, user.id)
    ),
  })
  if (!member) throw createError({ statusCode: 403, statusMessage: 'Not a workspace member' })

  // Check if key already exists — update if so
  const existing = await db.query.workspaceEnvVars.findFirst({
    where: and(
      eq(schema.workspaceEnvVars.workspaceId, workspaceId),
      eq(schema.workspaceEnvVars.key, normalizedKey)
    ),
  })

  if (existing) {
    await db.update(schema.workspaceEnvVars)
      .set({ value })
      .where(eq(schema.workspaceEnvVars.id, existing.id))
    return { id: existing.id, key: normalizedKey, value }
  }

  const result = await db.insert(schema.workspaceEnvVars).values({
    workspaceId,
    key: normalizedKey,
    value,
  }).returning()

  return result[0]
})
