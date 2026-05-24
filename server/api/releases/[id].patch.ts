import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const db = getDb()
  const { id } = getRouterParams(event)

  const body = await readBody(event)

  const existing = await db.query.docsReleases.findFirst({
    where: eq(schema.docsReleases.id, id),
  })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Release not found' })
  }

  const updated = await db.update(schema.docsReleases)
    .set({
      published: body.published ?? existing.published,
      heroTitle: body.heroTitle ?? existing.heroTitle,
      summary: body.summary ?? existing.summary,
      features: body.features ?? existing.features,
      categories: body.categories ?? existing.categories,
      updatedAt: new Date(),
    })
    .where(eq(schema.docsReleases.id, id))
    .returning()

  return updated[0]
})
