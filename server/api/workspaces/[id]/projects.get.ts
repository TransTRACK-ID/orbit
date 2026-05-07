import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, count, and, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireWorkspaceAccess(event, id)
  const db = getDb()

  const projectsList = await db.query.projects.findMany({
    where: eq(schema.projects.workspaceId, id),
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  })

  // Attach task counts and member counts per project
  const result = await Promise.all(
    projectsList.map(async (project) => {
      const totalTasks = await db
        .select({ count: count() })
        .from(schema.tasks)
        .where(eq(schema.tasks.projectId, project.id))

      // Find "Done"-like statuses for this project
      const statuses = await db.query.statuses.findMany({
        where: eq(schema.statuses.projectId, project.id),
        columns: { id: true, name: true },
      })

      const doneStatusIds = statuses
        .filter((s) => /done/i.test(s.name))
        .map((s) => s.id)

      const doneTasks = doneStatusIds.length > 0
        ? await db
            .select({ count: count() })
            .from(schema.tasks)
            .where(
              and(
                eq(schema.tasks.projectId, project.id),
                inArray(schema.tasks.statusId, doneStatusIds),
              ),
            )
        : [{ count: 0 }]

      const memberCount = await db
        .select({ count: count() })
        .from(schema.projectMembers)
        .where(eq(schema.projectMembers.projectId, project.id))

      return {
        ...project,
        _count: {
          tasks: Number(totalTasks[0]?.count || 0),
          doneTasks: Number(doneTasks[0]?.count || 0),
          members: Number(memberCount[0]?.count || 0),
        },
      }
    }),
  )

  return result
})
