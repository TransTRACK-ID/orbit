import { requireSuperAdmin } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { count, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const db = getDb()

  const [usersResult] = await db.select({ value: count() }).from(schema.users)
  const [workspacesResult] = await db.select({ value: count() }).from(schema.workspaces)
  const [projectsResult] = await db.select({ value: count() }).from(schema.projects)
  const [tasksResult] = await db.select({ value: count() }).from(schema.tasks)
  const [activityResult] = await db.select({ value: count() }).from(schema.activityFeed)

  // Tasks created in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [recentTasksResult] = await db
    .select({ value: count() })
    .from(schema.tasks)
    .where(sql`${schema.tasks.createdAt} >= ${sevenDaysAgo}`)

  // Activity in last 7 days
  const [recentActivityResult] = await db
    .select({ value: count() })
    .from(schema.activityFeed)
    .where(sql`${schema.activityFeed.createdAt} >= ${sevenDaysAgo}`)

  return {
    users: usersResult.value,
    workspaces: workspacesResult.value,
    projects: projectsResult.value,
    tasks: tasksResult.value,
    activity: activityResult.value,
    recentTasks: recentTasksResult.value,
    recentActivity: recentActivityResult.value,
  }
})
