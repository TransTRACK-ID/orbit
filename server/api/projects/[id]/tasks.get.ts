import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { unifyAssignee } from '~/server/utils/unify-assignee'
import { eq, asc, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireProjectAccess(event, id)
  const db = getDb()

  const query = getQuery(event)
  const includeArchived = query.includeArchived === 'true'

  const allTasks = await db.query.tasks.findMany({
    where: includeArchived
      ? eq(schema.tasks.projectId, id)
      : and(eq(schema.tasks.projectId, id), eq(schema.tasks.archived, false)),
    with: {
      assignee: {
        columns: { id: true, email: true, name: true, avatarUrl: true },
      },
      agentAssignee: true,
      reporter: {
        columns: { id: true, email: true, name: true, avatarUrl: true },
      },
      status: true,
      taskLabels: {
        with: {
          label: true,
        },
      },
      subtasks: true,
    },
    orderBy: [asc(schema.tasks.position)],
  })

  return allTasks.map((task) => ({
    ...unifyAssignee(task),
    labels: task.taskLabels?.map((tl) => tl.label) || [],
    taskLabels: undefined,
  }))
})
