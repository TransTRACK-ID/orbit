import { requireSuperAdmin } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { count, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const db = getDb()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // ── All projects with workspace ──
  const projectsList = await db.query.projects.findMany({
    with: {
      workspace: true,
    },
  })

  // ── Task counts per project ──
  const taskCounts = await db
    .select({
      projectId: schema.tasks.projectId,
      count: count(),
    })
    .from(schema.tasks)
    .groupBy(schema.tasks.projectId)

  const taskCountMap = new Map<string, number>()
  for (const row of taskCounts) {
    if (row.projectId) taskCountMap.set(row.projectId, row.count)
  }

  // ── Recent task counts per project (last 30 days) ──
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
    if (row.projectId) recentTaskCountMap.set(row.projectId, row.count)
  }

  // ── Task distribution by status per project ──
  const statusDistribution = await db
    .select({
      projectId: schema.tasks.projectId,
      statusId: schema.tasks.statusId,
      count: count(),
    })
    .from(schema.tasks)
    .groupBy(schema.tasks.projectId, schema.tasks.statusId)

  // Get all statuses with names
  const allStatuses = await db.query.statuses.findMany()
  const statusNameMap = new Map<string, string>()
  const statusColorMap = new Map<string, string>()
  for (const s of allStatuses) {
    statusNameMap.set(s.id, s.name)
    statusColorMap.set(s.id, s.color)
  }

  // Build distribution map: projectId -> { statusName, count, color }[]
  const distributionMap = new Map<string, { statusName: string; count: number; color: string }[]>()
  for (const row of statusDistribution) {
    if (!row.projectId) continue
    const arr = distributionMap.get(row.projectId) || []
    arr.push({
      statusName: statusNameMap.get(row.statusId || '') || 'Unknown',
      count: row.count,
      color: statusColorMap.get(row.statusId || '') || '#94a3b8',
    })
    distributionMap.set(row.projectId, arr)
  }

  // ── Member counts per project ──
  const memberCounts = await db
    .select({
      projectId: schema.projectMembers.projectId,
      count: count(),
    })
    .from(schema.projectMembers)
    .groupBy(schema.projectMembers.projectId)

  const memberCountMap = new Map<string, number>()
  for (const row of memberCounts) {
    if (row.projectId) memberCountMap.set(row.projectId, row.count)
  }

  // ── Recent activity per project (via workspace activity feed) ──
  const projectActivity = await db
    .select({
      workspaceId: schema.activityFeed.workspaceId,
      count: count(),
    })
    .from(schema.activityFeed)
    .where(sql`${schema.activityFeed.createdAt} >= ${thirtyDaysAgo}`)
    .groupBy(schema.activityFeed.workspaceId)

  const activityByWorkspaceMap = new Map<string, number>()
  for (const row of projectActivity) {
    if (row.workspaceId) activityByWorkspaceMap.set(row.workspaceId, row.count)
  }

  // ── Daily platform task velocity ──
  const dailyVelocity = await db
    .select({
      date: sql<string>`DATE(${schema.tasks.createdAt})`,
      count: count(),
    })
    .from(schema.tasks)
    .where(sql`${schema.tasks.createdAt} >= ${thirtyDaysAgo}`)
    .groupBy(sql`DATE(${schema.tasks.createdAt})`)
    .orderBy(sql`DATE(${schema.tasks.createdAt})`)

  // ── Compose project analytics ──
  const projectAnalytics = projectsList.map((p) => {
    const totalTasks = taskCountMap.get(p.id) || 0
    const recentTasks = recentTaskCountMap.get(p.id) || 0
    const members = memberCountMap.get(p.id) || 0
    const distribution = distributionMap.get(p.id) || []
    const workspaceActivity = activityByWorkspaceMap.get((p.workspace as any)?.id || '') || 0

    // Calculate health score: (recentTasks / totalTasks) * 100, capped at 100
    const healthScore = totalTasks > 0 ? Math.min(100, Math.round((recentTasks / totalTasks) * 100)) : 0

    return {
      id: p.id,
      name: p.name,
      color: p.color,
      workspaceName: (p.workspace as any)?.name || '',
      workspaceSlug: (p.workspace as any)?.slug || '',
      workspaceId: (p.workspace as any)?.id || '',
      createdAt: p.createdAt,
      totalTasks,
      recentTasks,
      members,
      distribution,
      workspaceActivity,
      healthScore,
    }
  })

  // Sort by total tasks desc
  projectAnalytics.sort((a, b) => b.totalTasks - a.totalTasks)

  return {
    projectAnalytics,
    dailyVelocity: dailyVelocity.map((d) => ({
      date: d.date,
      count: d.count,
    })),
  }
})
