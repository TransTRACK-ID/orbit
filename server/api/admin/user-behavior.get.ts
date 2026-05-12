import { requireSuperAdmin } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { count, desc, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const db = getDb()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // ── Daily platform activity timeline ──
  const dailyActivity = await db
    .select({
      date: sql<string>`DATE(${schema.activityFeed.createdAt})`,
      count: count(),
    })
    .from(schema.activityFeed)
    .where(sql`${schema.activityFeed.createdAt} >= ${thirtyDaysAgo}`)
    .groupBy(sql`DATE(${schema.activityFeed.createdAt})`)
    .orderBy(sql`DATE(${schema.activityFeed.createdAt})`)

  // ── Tasks created per day (velocity) ──
  const dailyTasks = await db
    .select({
      date: sql<string>`DATE(${schema.tasks.createdAt})`,
      count: count(),
    })
    .from(schema.tasks)
    .where(sql`${schema.tasks.createdAt} >= ${thirtyDaysAgo}`)
    .groupBy(sql`DATE(${schema.tasks.createdAt})`)
    .orderBy(sql`DATE(${schema.tasks.createdAt})`)

  // ── User engagement metrics ──
  const allUsers = await db.query.users.findMany({
    orderBy: desc(schema.users.createdAt),
  })

  // Tasks created per user (reporter)
  const tasksCreated = await db
    .select({
      userId: schema.tasks.reporterId,
      count: count(),
    })
    .from(schema.tasks)
    .groupBy(schema.tasks.reporterId)

  const tasksCreatedMap = new Map<string, number>()
  for (const row of tasksCreated) {
    if (row.userId) tasksCreatedMap.set(row.userId, row.count)
  }

  // Tasks assigned per user
  const tasksAssigned = await db
    .select({
      userId: schema.tasks.assigneeId,
      count: count(),
    })
    .from(schema.tasks)
    .groupBy(schema.tasks.assigneeId)

  const tasksAssignedMap = new Map<string, number>()
  for (const row of tasksAssigned) {
    if (row.userId) tasksAssignedMap.set(row.userId, row.count)
  }

  // Comments made per user
  const commentsMade = await db
    .select({
      userId: schema.comments.userId,
      count: count(),
    })
    .from(schema.comments)
    .groupBy(schema.comments.userId)

  const commentsMap = new Map<string, number>()
  for (const row of commentsMade) {
    if (row.userId) commentsMap.set(row.userId, row.count)
  }

  // Activity count per user (last 30 days)
  const activityCounts = await db
    .select({
      userId: schema.activityFeed.userId,
      count: count(),
    })
    .from(schema.activityFeed)
    .where(sql`${schema.activityFeed.createdAt} >= ${thirtyDaysAgo}`)
    .groupBy(schema.activityFeed.userId)

  const activityMap = new Map<string, number>()
  for (const row of activityCounts) {
    if (row.userId) activityMap.set(row.userId, row.count)
  }

  // Total activity count per user (all time)
  const totalActivityCounts = await db
    .select({
      userId: schema.activityFeed.userId,
      count: count(),
    })
    .from(schema.activityFeed)
    .groupBy(schema.activityFeed.userId)

  const totalActivityMap = new Map<string, number>()
  for (const row of totalActivityCounts) {
    if (row.userId) totalActivityMap.set(row.userId, row.count)
  }

  const userEngagement = allUsers.map((u) => {
    const created = tasksCreatedMap.get(u.id) || 0
    const assigned = tasksAssignedMap.get(u.id) || 0
    const comments = commentsMap.get(u.id) || 0
    const activity30d = activityMap.get(u.id) || 0
    const totalActivity = totalActivityMap.get(u.id) || 0
    // Simple engagement score: weighted sum of all activities
    const engagementScore = created * 2 + assigned + comments * 1.5 + activity30d

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl,
      role: u.role,
      createdAt: u.createdAt,
      tasksCreated: created,
      tasksAssigned: assigned,
      commentsMade: comments,
      activity30d,
      totalActivity,
      engagementScore,
    }
  })

  // Sort by engagement score desc
  userEngagement.sort((a, b) => b.engagementScore - a.engagementScore)

  // ── Top 5 most active users (by total activity) ──
  const topUsers = [...userEngagement]
    .sort((a, b) => b.totalActivity - a.totalActivity)
    .slice(0, 5)

  return {
    dailyActivity: dailyActivity.map((d) => ({
      date: d.date,
      count: d.count,
    })),
    dailyTasks: dailyTasks.map((d) => ({
      date: d.date,
      count: d.count,
    })),
    userEngagement,
    topUsers,
  }
})
