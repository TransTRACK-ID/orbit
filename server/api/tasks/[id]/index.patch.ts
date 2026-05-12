import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { updateTaskSchema } from '~/server/utils/validation'
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
  const body = await readValidatedBody(event, updateTaskSchema.parse)
  const db = getDb()

  const existing = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
  })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  const { labelIds, assigneeId, assigneeType, repositoryId, ...restData } = body
  const dataToUpdate: any = { ...restData }

  if (dataToUpdate.dueDate) {
    dataToUpdate.dueDate = new Date(dataToUpdate.dueDate)
  }

  if (assigneeId !== undefined || assigneeType !== undefined) {
    const resolvedType = assigneeType !== undefined ? assigneeType : existing.assigneeType
    dataToUpdate.assigneeType = resolvedType || null
    dataToUpdate.assigneeId = resolvedType === 'user' ? (assigneeId ?? null) : null
    dataToUpdate.agentAssigneeId = resolvedType === 'agent' ? (assigneeId ?? null) : null
  }

  if (Object.keys(dataToUpdate).length > 0) {
    await db
      .update(schema.tasks)
      .set(dataToUpdate)
      .where(eq(schema.tasks.id, id))
  }

  if (labelIds !== undefined) {
    await db.delete(schema.taskLabels).where(eq(schema.taskLabels.taskId, id))
    if (labelIds.length > 0) {
      await db.insert(schema.taskLabels).values(
        labelIds.map((labelId) => ({ taskId: id, labelId }))
      )
    }
  }

  if (body.statusId && body.statusId !== existing.statusId) {
    const newStatus = await db.query.statuses.findFirst({
      where: eq(schema.statuses.id, body.statusId),
    })
    const oldStatus = await db.query.statuses.findFirst({
      where: eq(schema.statuses.id, existing.statusId),
    })
    await db.insert(schema.activityLogs).values({
      taskId: id,
      userId: user.id,
      action: 'status_change',
      oldValue: { statusId: existing.statusId, statusName: oldStatus?.name },
      newValue: { statusId: body.statusId, statusName: newStatus?.name },
    })
  }

  const newAssigneeId = dataToUpdate.assigneeId ?? dataToUpdate.agentAssigneeId ?? existing.assigneeId
  const oldAssigneeId = existing.assigneeId
  const newAssigneeType = dataToUpdate.assigneeType ?? existing.assigneeType
  if (newAssigneeId !== oldAssigneeId || newAssigneeType !== existing.assigneeType) {
    if (body.assigneeId !== undefined || body.assigneeType !== undefined) {
      await db.insert(schema.activityLogs).values({
        taskId: id,
        userId: user.id,
        action: 'assignee_change',
        oldValue: { assigneeId: existing.assigneeId, assigneeType: existing.assigneeType },
        newValue: { assigneeId: newAssigneeId, assigneeType: newAssigneeType },
      })
    }
  }

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
