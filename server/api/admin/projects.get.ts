import { requireSuperAdmin } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { count, desc, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const db = getDb()

  const projectsList = await db.query.projects.findMany({
    orderBy: desc(schema.projects.createdAt),
    with: {
      workspace: true,
    },
  })

  // Get task counts per project
  const taskCounts = await db
    .select({
      projectId: schema.tasks.projectId,
      count: count(),
    })
    .from(schema.tasks)
    .groupBy(schema.tasks.projectId)

  const taskCountMap = new Map<string, number>()
  for (const row of taskCounts) {
    if (row.projectId) {
      taskCountMap.set(row.projectId, row.count)
    }
  }

  // Get recent task counts per project (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const recentTaskCounts = await db
    .select({
      projectId: schema.tasks.projectId,
      count: count(),
    })
    .from(schema.tasks)
    .where(sql`${schema.tasks.createdAt} >= ${thirtyDaysAgo}`)
    .groupBy(schema.tasks.projectId)

  const recentTaskCountMap = new Map<string, number>()
  for (const row of recentTaskCounts) {
    if (row.projectId) {
      recentTaskCountMap.set(row.projectId, row.count)
    }
  }

  return projectsList.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    workspaceName: (p.workspace as any)?.name || '',
    workspaceSlug: (p.workspace as any)?.slug || '',
    createdAt: p.createdAt,
    taskCount: taskCountMap.get(p.id) || 0,
    recentTaskCount: recentTaskCountMap.get(p.id) || 0,
  }))
})
