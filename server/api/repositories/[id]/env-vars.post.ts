import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const repositoryId = getRouterParam(event, 'id')
  if (!repositoryId) throw createError({ statusCode: 400, statusMessage: 'Missing repository ID' })

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

  // Check if key already exists — update if so
  const existing = await db.query.repositoryEnvVars.findFirst({
    where: and(
      eq(schema.repositoryEnvVars.repositoryId, repositoryId),
      eq(schema.repositoryEnvVars.key, normalizedKey)
    ),
  })

  if (existing) {
    await db.update(schema.repositoryEnvVars)
      .set({ value })
      .where(eq(schema.repositoryEnvVars.id, existing.id))
    return { id: existing.id, key: normalizedKey, value }
  }

  const result = await db.insert(schema.repositoryEnvVars).values({
    repositoryId,
    key: normalizedKey,
    value,
  }).returning()

  return result[0]
})
