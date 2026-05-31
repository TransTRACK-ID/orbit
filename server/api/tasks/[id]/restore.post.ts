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
  const user = await requireAuth(event)
  const db = getDb()

  const existing = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    with: { project: true },
  })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  await db
    .update(schema.tasks)
    .set({ archived: false, updatedAt: new Date() })
    .where(eq(schema.tasks.id, id))

  const updated = await db.query.tasks.findFirst({
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
      taskLabels: {
        with: { label: true },
      },
    },
  })

  return {
    ...unifyAssignee(updated),
    labels: updated?.taskLabels?.map((tl) => tl.label) || [],
    taskLabels: undefined,
  }
})
