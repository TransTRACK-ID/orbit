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
  const dailySignups = await db.execute(sql`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM ${schema.users}
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `)

  // Daily task creation counts (last 30 days)
  const dailyTasks = await db.execute(sql`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM ${schema.tasks}
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `)

  // Workspace counts
  const workspaceCount = await db.execute(sql`SELECT COUNT(*) as count FROM ${schema.workspaces}`).then(r => Number(r[0]?.count || 0))
  const projectCount = await db.execute(sql`SELECT COUNT(*) as count FROM ${schema.projects}`).then(r => Number(r[0]?.count || 0))
  const taskCount = await db.execute(sql`SELECT COUNT(*) as count FROM ${schema.tasks}`).then(r => Number(r[0]?.count || 0))
  const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM ${schema.users}`).then(r => Number(r[0]?.count || 0))

  return {
    recentActivity,
    dailySignups: dailySignups.rows || dailySignups,
    dailyTasks: dailyTasks.rows || dailyTasks,
    stats: {
      users: userCount,
      workspaces: workspaceCount,
      projects: projectCount,
      tasks: taskCount,
    },
  }
})
