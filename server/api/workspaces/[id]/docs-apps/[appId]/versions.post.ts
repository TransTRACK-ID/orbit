import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id, appId } = getRouterParams(event)
  await requireWorkspaceAccess(event, id)
  const db = getDb()

  // Verify app belongs to workspace
  const app = await db.query.docsApps.findFirst({
    where: and(eq(schema.docsApps.id, appId), eq(schema.docsApps.workspaceId, id)),
  })
  if (!app) {
    throw createError({ statusCode: 404, statusMessage: 'App not found' })
  }

  const body = await readBody(event)
  if (!body.version || !body.date || !body.author) {
    throw createError({ statusCode: 400, statusMessage: 'Version, date, and author are required' })
  }

  const version = await db.insert(schema.docsVersions).values({
    appId,
    version: body.version,
    date: body.date,
    author: body.author,
    status: body.status || 'draft',
  }).returning()

  return version[0]
})
