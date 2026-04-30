import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

function unifyAssignee(task: any) {
  if (!task) return task
  const { agentAssignee, assignee, ...rest } = task
  const unified = task.assigneeType === 'agent' && agentAssignee
    ? { id: agentAssignee.id, name: agentAssignee.name, initials: agentAssignee.initials, color: agentAssignee.color }
    : task.assigneeType === 'user' ? assignee : null
  return { ...rest, assignee: unified }
}

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
