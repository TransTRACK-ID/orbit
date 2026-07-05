import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { logActivityFeed } from '~/server/utils/activity'
import { resolveBrainstormMode, decodeBrainstormTitle } from '~/server/utils/grill-mode'
import { extractGrillDecisionsFromMessages, formatResolvedDecisionsForTask } from '~/utils/grill-decisions'
import { eq, count, and, asc } from 'drizzle-orm'
import { z } from 'zod'

const convertSchema = z.object({
  projectId: z.string().uuid(),
  messageId: z.string().uuid().optional(),
  source: z.enum(['message', 'grill_summary']).default('message'),
}).superRefine((body, ctx) => {
  if (body.source === 'message' && !body.messageId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'messageId is required when source is message',
      path: ['messageId'],
    })
  }
  if (body.source === 'grill_summary' && body.messageId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'messageId must not be provided when source is grill_summary',
      path: ['messageId'],
    })
  }
})

export default defineEventHandler(async (event) => {
  const { id: brainstormId } = getRouterParams(event)
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, convertSchema.parse)
  const db = getDb()

  // Fetch the brainstorm with repository
  const brainstorm = await db.query.brainstorms.findFirst({
    where: eq(schema.brainstorms.id, brainstormId),
    with: { repository: true },
  })

  if (!brainstorm) {
    throw createError({ statusCode: 404, statusMessage: 'Brainstorm not found' })
  }

  const brainstormMode = resolveBrainstormMode(brainstorm)
  const displayTitle = decodeBrainstormTitle(brainstorm.title)

  let title = ''
  let content = ''
  let taskSourceLabel = 'brainstorm'

  if (body.source === 'grill_summary') {
    if (brainstormMode !== 'grill') {
      throw createError({ statusCode: 400, statusMessage: 'Grill summary tasks are only available for grill sessions' })
    }
    if (brainstorm.grillStatus !== 'complete') {
      throw createError({ statusCode: 400, statusMessage: 'Complete the grill session before creating a task' })
    }

    const allMessages = await db.query.brainstormMessages.findMany({
      where: eq(schema.brainstormMessages.brainstormId, brainstormId),
      orderBy: [asc(schema.brainstormMessages.createdAt)],
    })

    const ledger = extractGrillDecisionsFromMessages(allMessages, {
      grillStatus: brainstorm.grillStatus,
      currentQuestionId: brainstorm.currentQuestionId,
    })

    const initialPlan = allMessages.find((message) => message.role === 'user')?.content || null
    const formatted = formatResolvedDecisionsForTask(ledger, {
      title: displayTitle,
      initialPlan,
    })

    title = formatted.title
    content = formatted.description
    taskSourceLabel = 'grill summary'
  } else {
    const message = await db.query.brainstormMessages.findFirst({
      where: eq(schema.brainstormMessages.id, body.messageId!),
    })

    if (!message) {
      throw createError({ statusCode: 404, statusMessage: 'Message not found' })
    }

    if (message.brainstormId !== brainstormId) {
      throw createError({ statusCode: 400, statusMessage: 'Message does not belong to this brainstorm' })
    }

    content = message.content

    if (message.metadata?.type === 'grill_complete') {
      const allMessages = await db.query.brainstormMessages.findMany({
        where: eq(schema.brainstormMessages.brainstormId, brainstormId),
        orderBy: [asc(schema.brainstormMessages.createdAt)],
      })
      const ledger = extractGrillDecisionsFromMessages(allMessages, {
        grillStatus: brainstorm.grillStatus,
        currentQuestionId: brainstorm.currentQuestionId,
      })
      const initialPlan = allMessages.find((entry) => entry.role === 'user')?.content || null
      const formatted = formatResolvedDecisionsForTask(ledger, {
        title: displayTitle,
        initialPlan,
      })
      title = formatted.title
      content = formatted.description
      taskSourceLabel = 'grill summary'
    }
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

  if (!title) {
    // Auto-generate title from the message content
    const headingMatch = content.match(/^#{1,3}\s+(.+)$/m)
    if (headingMatch) {
      title = headingMatch[1].trim()
    } else {
      const firstLine = content.split('\n')[0].trim()
      title = firstLine.replace(/^\*\*(.+)\*\*$/, '$1')
      if (title.length > 100) {
        const sentenceMatch = title.match(/^([^.!?]+[.!?])/)
        title = sentenceMatch ? sentenceMatch[1].trim() : title.slice(0, 97) + '...'
      }
    }
  }

  if (!title || title.length < 1) {
    title = 'Task from brainstorm'
  }

  // Truncate to 500 chars
  title = title.slice(0, 500)

  // Infer priority from keywords
  const lowerContent = content.toLowerCase()
  let priority = 'none'
  if (/\b(urgent|critical|asap|emergency|blocker)\b/.test(lowerContent)) {
    priority = 'urgent'
  } else if (/\b(high priority|important|must have|high)\b/.test(lowerContent)) {
    priority = 'high'
  } else if (/\b(medium priority|nice to have|should have|medium)\b/.test(lowerContent)) {
    priority = 'medium'
  } else if (/\b(low priority|minor|trivial|low)\b/.test(lowerContent)) {
    priority = 'low'
  }

  // Calculate position: place at the end of the backlog
  const tasksInBacklog = await db
    .select({ count: count() })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.projectId, body.projectId),
        eq(schema.tasks.statusId, backlogStatus.id)
      )
    )

  const position = (Number(tasksInBacklog[0]?.count || 0)) * 1000

  // Create the task
  const inserted = await db
    .insert(schema.tasks)
    .values({
      projectId: body.projectId,
      statusId: backlogStatus.id,
      reporterId: user.id,
      title,
      description: content,
      position,
      priority,
      repositoryId: brainstorm.repositoryId || null,
      assigneeId: null,
      agentAssigneeId: null,
      assigneeType: null,
      observerId: null,
      parentTaskId: null,
      dueDate: null,
      estimate: null,
      branchName: null,
    })
    .returning()

  const task = (inserted as { id: string }[])[0]

  // Log activity
  await logActivityFeed({
    workspaceId: brainstorm.workspaceId,
    userId: user.id,
    action: 'task_created',
    entityType: 'task',
    entityId: task.id,
    entityName: title,
    message: `created task "${title}" from ${taskSourceLabel} "${displayTitle}"`,
  })

  // Auto-select "improvement" label — find or create it
  let improvementLabel = await db.query.labels.findFirst({
    where: and(
      eq(schema.labels.projectId, body.projectId),
      eq(schema.labels.name, 'improvement')
    ),
  })

  if (!improvementLabel) {
    const [createdLabel] = await db
      .insert(schema.labels)
      .values({
        projectId: body.projectId,
        name: 'improvement',
        color: '#3b82f6',
      })
      .returning()
    improvementLabel = createdLabel
  }

  if (improvementLabel) {
    await db.insert(schema.taskLabels).values({
      taskId: task.id,
      labelId: improvementLabel.id,
    })
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
    labels: createdTask?.taskLabels?.map((tl: { label: { id: string; name: string; color: string } }) => tl.label) || [],
    taskLabels: undefined,
  }
})
