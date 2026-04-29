import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    with: {
      assignee: {
        columns: { id: true, email: true, name: true, avatarUrl: true },
      },
      reporter: {
        columns: { id: true, email: true, name: true, avatarUrl: true },
      },
      status: true,
      project: true,
      taskLabels: {
        with: { label: true },
      },
      subtasks: {
        with: {
          assignee: {
            columns: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
      },
    },
  })

  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  return {
    ...task,
    labels: task.taskLabels?.map((tl) => tl.label) || [],
    taskLabels: undefined,
  }
})
