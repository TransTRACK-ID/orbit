import type { H3Event } from 'h3'
import { getRequestHeaders, getRequestHost, getRequestProtocol } from 'h3'
import { and, eq, ilike } from 'drizzle-orm'
import { getDb, schema } from '~/server/database'

type Db = ReturnType<typeof getDb>

export async function recordAgentCompleted(
  db: Db,
  taskId: string,
  userId: string,
  details?: { exitCode?: number | null; prUrl?: string | null },
) {
  await db.insert(schema.activityLogs).values({
    taskId,
    userId,
    action: 'agent_completed',
    newValue: {
      exitCode: details?.exitCode ?? 0,
      prUrl: details?.prUrl ?? null,
      message: 'Agent completed successfully',
    },
  })
}

export async function advanceAgentTaskToReview(
  db: Db,
  opts: { taskId: string; projectId: string; currentStatusId: string; userId: string },
): Promise<{ advanced: boolean; statusId?: string; statusName?: string }> {
  const currentStatus = await db.query.statuses.findFirst({
    where: eq(schema.statuses.id, opts.currentStatusId),
  })
  if (!currentStatus) return { advanced: false }

  if (/review/i.test(currentStatus.name) || /done/i.test(currentStatus.name)) {
    return { advanced: false }
  }

  if (!/progress/i.test(currentStatus.name)) {
    return { advanced: false }
  }

  const reviewStatus = await db.query.statuses.findFirst({
    where: and(
      eq(schema.statuses.projectId, opts.projectId),
      ilike(schema.statuses.name, '%review%'),
    ),
  })
  if (!reviewStatus || reviewStatus.id === opts.currentStatusId) {
    return { advanced: false }
  }

  await db.update(schema.tasks)
    .set({ statusId: reviewStatus.id })
    .where(eq(schema.tasks.id, opts.taskId))

  await db.insert(schema.activityLogs).values({
    taskId: opts.taskId,
    userId: opts.userId,
    action: 'status_change',
    oldValue: { statusId: opts.currentStatusId, statusName: currentStatus.name },
    newValue: { statusId: reviewStatus.id, statusName: reviewStatus.name },
  })

  return { advanced: true, statusId: reviewStatus.id, statusName: reviewStatus.name }
}

export async function tryCreateTaskPr(
  event: H3Event,
  taskId: string,
): Promise<{ url: string | null; noChanges?: boolean; error?: string }> {
  try {
    const baseUrl = `${getRequestProtocol(event)}://${getRequestHost(event)}`
    const res = await fetch(`${baseUrl}/api/tasks/${taskId}/pr`, {
      method: 'POST',
      headers: { cookie: getRequestHeaders(event).cookie || '' },
    })
    if (res.ok) {
      return await res.json() as { url: string | null; noChanges?: boolean }
    }
    const errorBody = await res.text().catch(() => '')
    return { url: null, error: errorBody.slice(0, 400) || `HTTP ${res.status}` }
  } catch (err: any) {
    return { url: null, error: err?.message || String(err) }
  }
}

export async function finalizeAgentTaskSuccess(
  db: Db,
  event: H3Event,
  opts: {
    taskId: string
    projectId: string
    statusId: string
    userId: string
    agentEnabled: boolean
    exitCode: number
    skipStatusAdvance?: boolean
    repositoryRequired?: boolean
    branchName?: string
  },
): Promise<{ prUrl: string | null; noChanges?: boolean; prError?: string; advancedTo?: string }> {
  let prUrl: string | null = null
  let noChanges = false
  let prError: string | undefined

  if (opts.repositoryRequired && opts.branchName) {
    const prResult = await tryCreateTaskPr(event, opts.taskId)
    prUrl = prResult.url
    noChanges = !!prResult.noChanges
    prError = prResult.error
  }

  await recordAgentCompleted(db, opts.taskId, opts.userId, {
    exitCode: opts.exitCode,
    prUrl,
  })

  let advancedTo: string | undefined
  if (opts.agentEnabled && !opts.skipStatusAdvance) {
    const { advanced, statusName } = await advanceAgentTaskToReview(db, {
      taskId: opts.taskId,
      projectId: opts.projectId,
      currentStatusId: opts.statusId,
      userId: opts.userId,
    })
    if (advanced && statusName) {
      advancedTo = statusName
    }
  }

  return { prUrl, noChanges, prError, advancedTo }
}
