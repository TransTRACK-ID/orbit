import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, count } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = getDb()

  const memberships = await db.query.workspaceMembers.findMany({
    where: eq(schema.workspaceMembers.userId, user.id),
    with: {
      workspace: true,
    },
  })

  const workspaces = memberships.map((m) => m.workspace)

  // Add member and project counts
  const result = await Promise.all(
    workspaces.map(async (ws) => {
      const memberCount = await db
        .select({ count: count() })
        .from(schema.workspaceMembers)
        .where(eq(schema.workspaceMembers.workspaceId, ws.id))

      const projectCount = await db
        .select({ count: count() })
        .from(schema.projects)
        .where(eq(schema.projects.workspaceId, ws.id))

      return {
        ...ws,
        _count: {
          members: Number(memberCount[0]?.count || 0),
          projects: Number(projectCount[0]?.count || 0),
        },
      }
    })
  )

  return result
})
