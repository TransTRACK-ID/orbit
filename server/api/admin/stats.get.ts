import { requireSuperAdmin } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { count, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const db = getDb()

  const [userCount] = await db.select({ count: count() }).from(schema.users)
  const [workspaceCount] = await db.select({ count: count() }).from(schema.workspaces)
  const [projectCount] = await db.select({ count: count() }).from(schema.projects)
  const [taskCount] = await db.select({ count: count() }).from(schema.tasks)
  const [commentCount] = await db.select({ count: count() }).from(schema.comments)
  const [activityCount] = await db.select({ count: count() }).from(schema.activityFeed)

  // Recent signups (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [recentUsers] = await db
    .select({ count: count() })
    .from(schema.users)
    .where(sql`${schema.users.createdAt} >= ${sevenDaysAgo}`)

  // Tasks created last 7 days
  const [recentTasks] = await db
    .select({ count: count() })
    .from(schema.tasks)
    .where(sql`${schema.tasks.createdAt} >= ${sevenDaysAgo}`)

  return {
    users: Number(userCount.count),
    workspaces: Number(workspaceCount.count),
    projects: Number(projectCount.count),
    tasks: Number(taskCount.count),
    comments: Number(commentCount.count),
    activities: Number(activityCount.count),
    recentUsers: Number(recentUsers.count),
    recentTasks: Number(recentTasks.count),
  }
})
