import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireWorkspaceAccess(event, id)
  const db = getDb()

  // Get all apps in workspace
  const apps = await db.query.docsApps.findMany({
    where: eq(schema.docsApps.workspaceId, id),
    with: {
      versions: true,
    },
  })

  // Collect version IDs
  const versionIds = apps.flatMap(app => app.versions.map(v => v.id))

  // Get releases for those versions
  const releasesData = versionIds.length > 0
    ? await db.query.docsReleases.findMany({
        where: inArray(schema.docsReleases.versionId, versionIds),
        with: {
          version: true,
        },
      })
    : []

  // Build app lookup
  const appMap = new Map(apps.map(a => [a.id, a]))
  const versionMap = new Map(apps.flatMap(a => a.versions.map(v => [v.id, { ...v, app: a }])))

  // Flatten published releases
  const releases: any[] = []
  releasesData.forEach(r => {
    if (!r.published) return
    const version = versionMap.get(r.versionId)
    if (!version) return
    const app = version.app
    releases.push({
      id: r.id,
      versionId: version.id,
      app: app.name,
      appId: app.id,
      appSlug: app.slug,
      version: version.version,
      date: version.date,
      author: version.author,
      status: version.status,
      summary: r.summary,
      heroTitle: r.heroTitle,
      features: r.features,
      categories: r.categories,
    })
  })

  // Sort by date descending
  releases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return releases
})
