import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { unifyAssignee } from '~/server/utils/unify-assignee'
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
      agentAssignee: true,
      observer: {
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
          agentAssignee: true,
        },
      },
    },
  })

  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  return {
    ...unifyAssignee(task),
    labels: task.taskLabels?.map((tl) => tl.label) || [],
    taskLabels: undefined,
    subtasks: task.subtasks?.map((st: any) => unifyAssignee(st)) || [],
  }
})
