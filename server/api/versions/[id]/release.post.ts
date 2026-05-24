import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const db = getDb()
  const { id } = getRouterParams(event)

  const body = await readBody(event)

  // Check if release already exists for this version
  const existing = await db.query.docsReleases.findFirst({
    where: eq(schema.docsReleases.versionId, id),
  })

  if (existing) {
    // Update existing
    const updated = await db.update(schema.docsReleases)
      .set({
        published: body.published ?? existing.published,
        heroTitle: body.heroTitle ?? existing.heroTitle,
        summary: body.summary ?? existing.summary,
        features: body.features ?? existing.features,
        categories: body.categories ?? existing.categories,
        updatedAt: new Date(),
      })
      .where(eq(schema.docsReleases.id, existing.id))
      .returning()

    return updated[0]
  }

  // Create new
  const release = await db.insert(schema.docsReleases).values({
    versionId: id,
    published: body.published ?? false,
    heroTitle: body.heroTitle || null,
    summary: body.summary || null,
    features: body.features || [],
    categories: body.categories || {},
  }).returning()

  return release[0]
})
