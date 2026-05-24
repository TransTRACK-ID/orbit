import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireWorkspaceAccess(event, id)
  const db = getDb()

  const apps = await db.query.docsApps.findMany({
    where: eq(schema.docsApps.workspaceId, id),
    with: {
      versions: {
        orderBy: (v, { desc }) => [desc(v.date)],
      },
    },
    orderBy: (a, { asc }) => [asc(a.name)],
  })

  // Manually attach releases to versions
  const versionIds = apps.flatMap(a => a.versions.map(v => v.id))
  const releases = versionIds.length > 0
    ? await db.query.docsReleases.findMany({
        where: inArray(schema.docsReleases.versionId, versionIds),
      })
    : []

  const releaseMap = new Map(releases.map(r => [r.versionId, r]))

  return apps.map(app => ({
    ...app,
    versions: app.versions.map(v => ({
      ...v,
      release: releaseMap.get(v.id) || null,
    })),
  }))
})
