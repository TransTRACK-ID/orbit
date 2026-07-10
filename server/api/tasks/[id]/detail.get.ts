import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { unifyAssignee } from '~/server/utils/unify-assignee'
import { eq, asc, desc, and, ne } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  // Fetch task first to resolve default agent metadata for agent replies
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    columns: { agentAssigneeId: true, assigneeType: true },
    with: {
      agentAssignee: {
        columns: { id: true, name: true, color: true },
      },
    },
  })

  const defaultAgentName = task?.assigneeType === 'agent' && task?.agentAssignee
    ? task.agentAssignee.name
    : 'Agent'
  const defaultAgentColor = task?.assigneeType === 'agent' && task?.agentAssignee
    ? task.agentAssignee.color
    : '#6366f1'

  // Fetch all task relations in parallel over a single DB connection pool
  const [taskDetail, comments, activityLogs, attachments, agentReplyLogs] = await Promise.all([
    db.query.tasks.findFirst({
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
    }),
    db.query.comments.findMany({
      where: eq(schema.comments.taskId, id),
      with: {
        user: {
          columns: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
      orderBy: [asc(schema.comments.createdAt)],
    }),
    db.query.activityLogs.findMany({
      where: and(
        eq(schema.activityLogs.taskId, id),
        ne(schema.activityLogs.action, 'runtime_log'),
      ),
      with: {
        user: {
          columns: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
      orderBy: [desc(schema.activityLogs.createdAt)],
    }),
    db.query.taskAttachments.findMany({
      where: eq(schema.taskAttachments.taskId, id),
      orderBy: [asc(schema.taskAttachments.createdAt)],
    }),
    db.query.activityLogs.findMany({
      where: and(
        eq(schema.activityLogs.taskId, id),
        eq(schema.activityLogs.action, 'agent_reply'),
      ),
      orderBy: [desc(schema.activityLogs.createdAt)],
      limit: 500,
    }),
  ])

  if (!taskDetail) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  return {
    task: {
      ...unifyAssignee(taskDetail),
      labels: taskDetail.taskLabels?.map((tl) => tl.label) || [],
      taskLabels: undefined,
      subtasks: taskDetail.subtasks?.map((st: any) => unifyAssignee(st)) || [],
    },
    comments,
    activityLogs,
    attachments: attachments.map((a) => ({
      id: a.id,
      taskId: a.taskId,
      filename: a.filename,
      originalName: a.originalName,
      mimeType: a.mimeType,
      size: a.size,
      path: a.path,
      createdAt: a.createdAt,
    })),
    agentReplies: agentReplyLogs.map((log) => ({
      id: `agent-${log.id}`,
      body: (log.newValue as { message: string }).message,
      createdAt: log.createdAt,
      agentName: defaultAgentName,
      agentColor: defaultAgentColor,
    })),
  }
})
