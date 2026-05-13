import { getDb, schema } from '~/server/database'
import { requireSuperAdmin } from '~/server/utils/auth'
import { sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const db = getDb()

  // Recent activity feed entries
  const recentActivity = await db.query.activityFeed.findMany({
    limit: 50,
    orderBy: (af, { desc }) => [desc(af.createdAt)],
    with: { user: true, workspace: true },
  })

  // Daily signup counts (last 30 days)
  const dailySignupsResult = await db.execute(sql`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM ${schema.users}
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `)

  // Daily task creation counts (last 30 days)
  const dailyTasksResult = await db.execute(sql`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM ${schema.tasks}
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `)

  // Workspace counts
  const workspaceCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM ${schema.workspaces}`)
  const projectCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM ${schema.projects}`)
  const taskCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM ${schema.tasks}`)
  const userCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM ${schema.users}`)

  const workspaceCount = Number(workspaceCountResult.rows[0]?.count || 0)
  const projectCount = Number(projectCountResult.rows[0]?.count || 0)
  const taskCount = Number(taskCountResult.rows[0]?.count || 0)
  const userCount = Number(userCountResult.rows[0]?.count || 0)

  const result = {
    recentActivity,
    dailySignups: dailySignupsResult.rows,
    dailyTasks: dailyTasksResult.rows,
    stats: {
      users: userCount,
      workspaces: workspaceCount,
      projects: projectCount,
      tasks: taskCount,
    },
  }

  return result
})
