import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { logActivityFeed } from '~/server/utils/activity'
import { eq, count, and, asc } from 'drizzle-orm'
import { z } from 'zod'

const commitTasksSchema = z.object({
  projectId: z.string().uuid(),
  tasks: z.array(z.object({
    title: z.string().min(1).max(500),
    description: z.string().optional(),
    priority: z.enum(['none', 'urgent', 'high', 'medium', 'low']).default('none'),
    estimateHours: z.number().nullable().optional(),
    labels: z.array(z.string()).optional(),
    parentIndex: z.number().nullable().optional(),
  })),
})

export default defineEventHandler(async (event) => {
  const { id: prdId } = getRouterParams(event)
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, commitTasksSchema.parse)
  const db = getDb()

  // Fetch PRD
  const prd = await db.query.prds.findFirst({
    where: eq(schema.prds.id, prdId),
  })

  if (!prd) {
    throw createError({ statusCode: 404, statusMessage: 'PRD not found' })
  }

  // Find backlog status for the project
  const projectStatuses = await db.query.statuses.findMany({
    where: eq(schema.statuses.projectId, body.projectId),
    orderBy: [asc(schema.statuses.position)],
  })

  const backlogStatus = projectStatuses.find((s) => /backlog/i.test(s.name))
  if (!backlogStatus) {
    throw createError({ statusCode: 400, statusMessage: 'No backlog status found for this project' })
  }

  // Calculate starting position: place at the end of the backlog
  const tasksInBacklog = await db
    .select({ count: count() })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.projectId, body.projectId),
        eq(schema.tasks.statusId, backlogStatus.id)
      )
    )

  let position = (Number(tasksInBacklog[0]?.count || 0)) * 1000

  // Fetch existing labels for this project
  const existingLabels = await db.query.labels.findMany({
    where: eq(schema.labels.projectId, body.projectId),
  })

  const labelMap = new Map(existingLabels.map(l => [l.name.toLowerCase(), l]))

  // Create missing labels with default colors
  const defaultColors: Record<string, string> = {
    feature: '#22c55e',
    bugfix: '#ef4444',
    improvement: '#3b82f6',
    refactor: '#8b5cf6',
    documentation: '#f59e0b',
    testing: '#06b6d4',
  }

  const createdTaskIds: string[] = []
  const parentTaskIdMap = new Map<number, string>() // Maps task index -> created task ID

  // Process tasks in order to handle parent-child relationships
  for (let i = 0; i < body.tasks.length; i++) {
    const taskData = body.tasks[i]

    // Determine parent task ID
    let parentTaskId: string | null = null
    if (taskData.parentIndex !== null && taskData.parentIndex !== undefined) {
      const parentId = parentTaskIdMap.get(taskData.parentIndex)
      if (parentId) {
        parentTaskId = parentId
      }
    }

    // Create the task
    const [task] = await db.insert(schema.tasks)
      .values({
        projectId: body.projectId,
        statusId: backlogStatus.id,
        reporterId: user.id,
        title: taskData.title,
        description: taskData.description || null,
        position,
        priority: taskData.priority,
        estimate: taskData.estimateHours || null,
        parentTaskId,
        repositoryId: null,
        assigneeId: null,
        agentAssigneeId: null,
        assigneeType: null,
        observerId: null,
        dueDate: null,
        branchName: null,
        agentEnabled: false,
      })
      .returning()

    createdTaskIds.push(task.id)
    parentTaskIdMap.set(i, task.id)
    position += 1000

    // Handle labels
    if (taskData.labels && taskData.labels.length > 0) {
      for (const labelName of taskData.labels) {
        const lowerName = labelName.toLowerCase()
        let label = labelMap.get(lowerName)

        if (!label) {
          // Create new label
          const [createdLabel] = await db.insert(schema.labels)
            .values({
              projectId: body.projectId,
              name: labelName,
              color: defaultColors[lowerName] || '#94a3b8',
            })
            .returning()
          label = createdLabel
          labelMap.set(lowerName, label)
        }

        if (label) {
          await db.insert(schema.taskLabels).values({
            taskId: task.id,
            labelId: label.id,
          })
        }
      }
    }
  }

  // Update PRD: mark tasks as generated
  await db.update(schema.prds)
    .set({ tasksGenerated: true })
    .where(eq(schema.prds.id, prdId))

  // Log activity for each created task
  for (let i = 0; i < createdTaskIds.length; i++) {
    const taskId = createdTaskIds[i]
    const taskData = body.tasks[i]
    await logActivityFeed({
      workspaceId: prd.workspaceId,
      userId: user.id,
      action: 'task_created',
      entityType: 'task',
      entityId: taskId,
      entityName: taskData.title,
      message: `created task "${taskData.title}" from PRD "${prd.title}"`,
    })
  }

  return {
    success: true,
    taskIds: createdTaskIds,
    count: createdTaskIds.length,
  }
})
