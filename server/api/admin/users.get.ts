import { requireSuperAdmin } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { count, desc, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const db = getDb()

  const usersList = await db.query.users.findMany({
    orderBy: desc(schema.users.createdAt),
    with: {
      workspaces: { with: { workspace: true } },
    },
  })

  // Get task counts per user
  const taskCounts = await db
    .select({
      userId: schema.tasks.assigneeId,
      count: count(),
    })
    .from(schema.tasks)
    .groupBy(schema.tasks.assigneeId)

  const taskCountMap = new Map<string, number>()
  for (const row of taskCounts) {
    if (row.userId) {
      taskCountMap.set(row.userId, row.count)
    }
  }

  // Get recent activity counts per user (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const activityCounts = await db
    .select({
      userId: schema.activityFeed.userId,
      count: count(),
    })
    .from(schema.activityFeed)
    .where(sql`${schema.activityFeed.createdAt} >= ${thirtyDaysAgo}`)
    .groupBy(schema.activityFeed.userId)

  const activityCountMap = new Map<string, number>()
  for (const row of activityCounts) {
    if (row.userId) {
      activityCountMap.set(row.userId, row.count)
    }
  }

  return usersList.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    role: u.role,
    createdAt: u.createdAt,
    workspaceCount: u.workspaces?.length || 0,
    taskCount: taskCountMap.get(u.id) || 0,
    activityCount: activityCountMap.get(u.id) || 0,
  }))
})
