import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { updateTaskSchema } from '~/server/utils/validation'
import { eq, inArray, and, max } from 'drizzle-orm'
import { z } from 'zod'

const bulkUpdateSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1),
  statusId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  assigneeType: z.enum(['user', 'agent']).nullable().optional(),
  priority: z.enum(['none', 'urgent', 'high', 'medium', 'low']).optional(),
})

function unifyAssignee(task: any) {
  if (!task) return task
  const { agentAssignee, assignee, ...rest } = task
  const unified = task.assigneeType === 'agent' && agentAssignee
    ? { id: agentAssignee.id, name: agentAssignee.name, initials: agentAssignee.initials, color: agentAssignee.color }
    : task.assigneeType === 'user' ? assignee : null
  return { ...rest, assignee: unified }
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, bulkUpdateSchema.parse)
  const db = getDb()

  // Fetch all tasks to verify existence and shared project
  const existingTasks = await db.query.tasks.findMany({
    where: inArray(schema.tasks.id, body.taskIds),
    with: { status: true, project: true },
  })

  if (existingTasks.length !== body.taskIds.length) {
    throw createError({ statusCode: 404, statusMessage: 'One or more tasks not found' })
  }

  const projectId = existingTasks[0].projectId
  if (!existingTasks.every((t) => t.projectId === projectId)) {
    throw createError({ statusCode: 400, statusMessage: 'Bulk update only supported for tasks in the same project' })
  }

  // Verify project access
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
    with: { workspace: true },
  })
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }
  const wsMember = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(schema.workspaceMembers.workspaceId, project.workspaceId),
      eq(schema.workspaceMembers.userId, user.id)
    ),
  })
  if (!wsMember) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  // If status is changing, compute max position in target status
  let nextPosition: number | undefined
  if (body.statusId) {
    const statusTasks = await db.query.tasks.findMany({
      where: and(
        eq(schema.tasks.projectId, projectId),
        eq(schema.tasks.statusId, body.statusId)
      ),
      orderBy: (t, { desc }) => [desc(t.position)],
      limit: 1,
    })
    const maxPos = statusTasks[0]?.position ?? 0
    nextPosition = maxPos + 1000
  }

  const updatedTasks = []
  for (let i = 0; i < existingTasks.length; i++) {
    const existing = existingTasks[i]
    const { labelIds, ...restData } = body as any
    const dataToUpdate: any = { ...restData }
    delete dataToUpdate.taskIds

    if (dataToUpdate.statusId && nextPosition !== undefined) {
      dataToUpdate.position = nextPosition + i * 1000
    }

    if (dataToUpdate.assigneeId !== undefined || dataToUpdate.assigneeType !== undefined) {
      const resolvedType = dataToUpdate.assigneeType !== undefined ? dataToUpdate.assigneeType : existing.assigneeType
      dataToUpdate.assigneeType = resolvedType || null
      dataToUpdate.assigneeId = resolvedType === 'user' ? (dataToUpdate.assigneeId ?? null) : null
      dataToUpdate.agentAssigneeId = resolvedType === 'agent' ? (dataToUpdate.assigneeId ?? null) : null
    }

    if (Object.keys(dataToUpdate).length > 0) {
      await db
        .update(schema.tasks)
        .set(dataToUpdate)
        .where(eq(schema.tasks.id, existing.id))
    }

    if (dataToUpdate.statusId && dataToUpdate.statusId !== existing.statusId) {
      const newStatus = await db.query.statuses.findFirst({
        where: eq(schema.statuses.id, dataToUpdate.statusId),
      })
      const oldStatus = await db.query.statuses.findFirst({
        where: eq(schema.statuses.id, existing.statusId),
      })
      await db.insert(schema.activityLogs).values({
        taskId: existing.id,
        userId: user.id,
        action: 'status_change',
        oldValue: { statusId: existing.statusId, statusName: oldStatus?.name },
        newValue: { statusId: dataToUpdate.statusId, statusName: newStatus?.name },
      })
    }

    const updated = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, existing.id),
      with: {
        assignee: { columns: { id: true, email: true, name: true, avatarUrl: true } },
        agentAssignee: true,
        observer: { columns: { id: true, email: true, name: true, avatarUrl: true } },
        reporter: { columns: { id: true, email: true, name: true, avatarUrl: true } },
        status: true,
        taskLabels: { with: { label: true } },
      },
    })

    if (updated) {
      updatedTasks.push({
        ...unifyAssignee(updated),
        labels: updated.taskLabels?.map((tl: any) => tl.label) || [],
        taskLabels: undefined,
      })
    }
  }

  return updatedTasks
})
