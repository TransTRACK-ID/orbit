import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const db = getDb()
  const { id } = getRouterParams(event)

  const release = await db.query.docsReleases.findFirst({
    where: eq(schema.docsReleases.id, id),
    with: {
      version: {
        with: {
          app: true,
        },
      },
    },
  })

  if (!release) {
    throw createError({ statusCode: 404, statusMessage: 'Release not found' })
  }

  return {
    id: release.id,
    versionId: release.versionId,
    published: release.published,
    heroTitle: release.heroTitle,
    summary: release.summary,
    features: release.features,
    categories: release.categories,
    createdAt: release.createdAt,
    updatedAt: release.updatedAt,
    version: release.version.version,
    date: release.version.date,
    author: release.version.author,
    status: release.version.status,
    app: release.version.app.name,
    appId: release.version.app.id,
    appSlug: release.version.app.slug,
  }
})
