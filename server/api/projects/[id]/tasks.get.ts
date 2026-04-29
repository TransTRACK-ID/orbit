import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireProjectAccess(event, id)
  const db = getDb()

  const allTasks = await db.query.tasks.findMany({
    where: eq(schema.tasks.projectId, id),
    with: {
      assignee: {
        columns: { id: true, email: true, name: true, avatarUrl: true },
      },
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

  // Transform the response to include labels directly
  return allTasks.map((task) => ({
    ...task,
    labels: task.taskLabels?.map((tl) => tl.label) || [],
    taskLabels: undefined,
  }))
})
