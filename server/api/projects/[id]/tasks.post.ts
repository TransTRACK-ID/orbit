import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { createTaskSchema } from '~/server/utils/validation'
import { eq, count, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id: projectId } = getRouterParams(event)
  const { user } = await requireProjectAccess(event, projectId)
  const body = await readValidatedBody(event, createTaskSchema.parse)
  const db = getDb()

  // Calculate position: place at the end of the target status column
  const tasksInStatus = await db
    .select({ count: count() })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.projectId, projectId),
        eq(schema.tasks.statusId, body.statusId)
      )
    )

  const position = (Number(tasksInStatus[0]?.count || 0)) * 1000

  // Create task
  const [task] = await db
    .insert(schema.tasks)
    .values({
      projectId,
      statusId: body.statusId,
      assigneeId: body.assigneeType === 'user' ? body.assigneeId : null,
      agentAssigneeId: body.assigneeType === 'agent' ? body.assigneeId : null,
      assigneeType: body.assigneeType || null,
      observerId: body.observerId || null,
      reporterId: user.id,
      title: body.title,
      description: body.description || null,
      position,
      priority: body.priority || 'none',
      repositoryId: body.repositoryId || null,
      parentTaskId: body.parentTaskId || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      estimate: body.estimate || null,
      branchName: body.branchName || null,
    })
    .returning()

  // Add labels if provided
  if (body.labelIds && body.labelIds.length > 0) {
    await db.insert(schema.taskLabels).values(
      body.labelIds.map((labelId) => ({
        taskId: task.id,
        labelId,
      }))
    )
  }

  // Fetch the created task with relations
  const createdTask = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, task.id),
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

  const { agentAssignee, assignee, ...rest } = createdTask || {}
  const unifiedAssignee = createdTask?.assigneeType === 'agent' && agentAssignee
    ? { id: agentAssignee.id, name: agentAssignee.name, initials: agentAssignee.initials, color: agentAssignee.color }
    : createdTask?.assigneeType === 'user' ? assignee : null

  return {
    ...rest,
    assignee: unifiedAssignee,
    agentAssignee: undefined,
    labels: createdTask?.taskLabels?.map((tl) => tl.label) || [],
    taskLabels: undefined,
  }
})
