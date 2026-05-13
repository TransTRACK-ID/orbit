import { getDb, schema } from '~/server/database'
import { requireSuperAdmin } from '~/server/utils/auth'
import { count, eq, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const db = getDb()

  const projectsList = await db.query.projects.findMany({
    orderBy: (projects, { desc }) => [desc(projects.createdAt)],
    with: { workspace: true },
  })

  const enriched = await Promise.all(
    projectsList.map(async (project) => {
      const taskCount = await db
        .select({ count: count() })
        .from(schema.tasks)
        .where(eq(schema.tasks.projectId, project.id))
        .then((r) => r[0]?.count || 0)

      const memberCount = await db
        .select({ count: count() })
        .from(schema.projectMembers)
        .where(eq(schema.projectMembers.projectId, project.id))
        .then((r) => r[0]?.count || 0)

      return {
        ...project,
        taskCount,
        memberCount,
      }
    })
  )

  return {
    projects: enriched,
    total: enriched.length,
  }
})
