import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const { user } = await requireWorkspaceAccess(event, id)
  const db = getDb()

  const body = await readBody(event)
  if (!body.name || !body.slug) {
    throw createError({ statusCode: 400, statusMessage: 'Name and slug are required' })
  }

  const app = await db.insert(schema.docsApps).values({
    workspaceId: id,
    name: body.name,
    slug: body.slug,
    currentVersion: body.currentVersion || null,
  }).returning()

  return app[0]
})
