import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { updateTaskSchema } from '~/server/utils/validation'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, updateTaskSchema.parse)
  const db = getDb()

  // Get existing task
  const existing = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
  })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  // Build update data (exclude labelIds — handled separately)
  const { labelIds, ...updateData } = body
  const dataToUpdate: any = { ...updateData }

  // Convert dueDate string to Date if provided
  if (dataToUpdate.dueDate) {
    dataToUpdate.dueDate = new Date(dataToUpdate.dueDate)
  }

  // Update task
  if (Object.keys(dataToUpdate).length > 0) {
    await db
      .update(schema.tasks)
      .set(dataToUpdate)
      .where(eq(schema.tasks.id, id))
  }

  // Update labels if provided
  if (labelIds !== undefined) {
    await db.delete(schema.taskLabels).where(eq(schema.taskLabels.taskId, id))
    if (labelIds.length > 0) {
      await db.insert(schema.taskLabels).values(
        labelIds.map((labelId) => ({ taskId: id, labelId }))
      )
    }
  }

  // Log activity for status or assignee changes
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

  if (body.assigneeId !== undefined && body.assigneeId !== existing.assigneeId) {
    await db.insert(schema.activityLogs).values({
      taskId: id,
      userId: user.id,
      action: 'assignee_change',
      oldValue: { assigneeId: existing.assigneeId },
      newValue: { assigneeId: body.assigneeId },
    })
  }

  // Fetch updated task
  const updated = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    with: {
      assignee: {
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
    ...updated,
    labels: updated?.taskLabels?.map((tl) => tl.label) || [],
    taskLabels: undefined,
  }
})
