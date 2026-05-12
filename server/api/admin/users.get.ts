import { getDb, schema } from '~/server/database'
import { requireSuperAdmin } from '~/server/utils/auth'
import { count, eq, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const db = getDb()

  const usersList = await db.query.users.findMany({
    orderBy: (users, { desc }) => [desc(users.createdAt)],
  })

  // Build stats per user
  const enriched = await Promise.all(
    usersList.map(async (user) => {
      const workspaceCount = await db
        .select({ count: count() })
        .from(schema.workspaceMembers)
        .where(eq(schema.workspaceMembers.userId, user.id))
        .then((r) => r[0]?.count || 0)

      const projectCount = await db
        .select({ count: count() })
        .from(schema.projectMembers)
        .where(eq(schema.projectMembers.userId, user.id))
        .then((r) => r[0]?.count || 0)

      const taskCount = await db
        .select({ count: count() })
        .from(schema.tasks)
        .where(eq(schema.tasks.reporterId, user.id))
        .then((r) => r[0]?.count || 0)

      const commentCount = await db
        .select({ count: count() })
        .from(schema.comments)
        .where(eq(schema.comments.userId, user.id))
        .then((r) => r[0]?.count || 0)

      return {
        ...user,
        workspaceCount,
        projectCount,
        taskCount,
        commentCount,
      }
    })
  )

  return {
    users: enriched,
    total: enriched.length,
  }
})
