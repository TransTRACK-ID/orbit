import { requireSuperAdmin } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, count, sql, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const db = getDb()

  const allUsers = await db.query.users.findMany({
    orderBy: desc(schema.users.createdAt),
  })

  // Enhance with per-user stats
  const usersWithStats = await Promise.all(
    allUsers.map(async (user) => {
      const [workspaceMemberCount] = await db
        .select({ count: count() })
        .from(schema.workspaceMembers)
        .where(eq(schema.workspaceMembers.userId, user.id))

      const [taskCreated] = await db
        .select({ count: count() })
        .from(schema.tasks)
        .where(eq(schema.tasks.reporterId, user.id))

      const [taskAssigned] = await db
        .select({ count: count() })
        .from(schema.tasks)
        .where(eq(schema.tasks.assigneeId, user.id))

      const [comments] = await db
        .select({ count: count() })
        .from(schema.comments)
        .where(eq(schema.comments.userId, user.id))

      const [activities] = await db
        .select({ count: count() })
        .from(schema.activityFeed)
        .where(eq(schema.activityFeed.userId, user.id))

      const [logins] = await db
        .select({ count: count() })
        .from(schema.activityFeed)
        .where(
          sql`${schema.activityFeed.userId} = ${user.id} AND ${schema.activityFeed.action} = 'login'`
        )

      return {
        ...user,
        workspaceCount: Number(workspaceMemberCount.count),
        tasksCreated: Number(taskCreated.count),
        tasksAssigned: Number(taskAssigned.count),
        commentsCount: Number(comments.count),
        activitiesCount: Number(activities.count),
        loginCount: Number(logins.count),
      }
    })
  )

  return usersWithStats
})
