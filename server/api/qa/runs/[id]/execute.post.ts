import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { executeQaRunSchema } from '~/server/utils/validation'
import { buildQaRunTaskDescription, getQaRunDetail } from '~/server/utils/qa-runs'
import { QA_RESULT_JSON_CONTRACT } from '~/utils/qa-result-format'
import { and, eq, count, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id: runId } = getRouterParams(event)
  const db = getDb()

  const run = await db.query.qaRuns.findFirst({
    where: eq(schema.qaRuns.id, runId),
    with: {
      runCases: {
        orderBy: (rc, { asc: a }) => [a(rc.sortOrder)],
      },
    },
  })
  if (!run) {
    throw createError({ statusCode: 404, statusMessage: 'QA run not found' })
  }

  const { user } = await requireProjectAccess(event, run.projectId)
  const body = await readValidatedBody(event, executeQaRunSchema.parse)

  const agentId = body.agentId || run.agentId
  if (!agentId) {
    throw createError({ statusCode: 400, statusMessage: 'agentId is required to execute a QA run' })
  }

  const agent = await db.query.agents.findFirst({
    where: eq(schema.agents.id, agentId),
  })
  if (!agent) {
    throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
  }
  if (!agent.browserEnabled) {
    throw createError({ statusCode: 400, statusMessage: 'Selected agent must have browser enabled (Martin)' })
  }

  const targetUrl = body.targetUrl || run.targetUrl
  if (!targetUrl) {
    throw createError({ statusCode: 400, statusMessage: 'targetUrl is required to execute a QA run' })
  }

  let taskId = body.taskId || run.taskId

  if (!taskId) {
    const statuses = await db.query.statuses.findMany({
      where: eq(schema.statuses.projectId, run.projectId),
      orderBy: [asc(schema.statuses.position)],
    })
    const inProgress = statuses.find((s) => /in\s*progress/i.test(s.name))
      || statuses.find((s) => s.name.toLowerCase() === 'todo')
      || statuses[0]
    if (!inProgress) {
      throw createError({ statusCode: 400, statusMessage: 'Project has no statuses to create a QA task' })
    }

    const tasksInStatus = await db
      .select({ count: count() })
      .from(schema.tasks)
      .where(and(
        eq(schema.tasks.projectId, run.projectId),
        eq(schema.tasks.statusId, inProgress.id),
      ))

    const description = [
      buildQaRunTaskDescription({
        runId,
        targetUrl,
        cases: (run.runCases || []).map((rc) => ({
          caseId: rc.caseId,
          title: rc.title,
          steps: (rc.steps || []) as any,
        })),
      }),
      '',
      QA_RESULT_JSON_CONTRACT,
    ].join('\n')

    const [task] = await db
      .insert(schema.tasks)
      .values({
        projectId: run.projectId,
        statusId: inProgress.id,
        assigneeId: null,
        agentAssigneeId: agentId,
        assigneeType: 'agent',
        reporterId: user.id,
        title: `QA Run: ${run.runCases?.[0]?.title || 'Test run'}`,
        description,
        position: (Number(tasksInStatus[0]?.count || 0)) * 1000,
        priority: 'medium',
        agentEnabled: true,
      })
      .returning()

    taskId = task.id
  } else {
    // Ensure linked task has QA instructions + agent assignee
    const task = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, taskId),
    })
    if (!task || task.projectId !== run.projectId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid task for this QA run' })
    }

    const description = [
      buildQaRunTaskDescription({
        runId,
        targetUrl,
        cases: (run.runCases || []).map((rc) => ({
          caseId: rc.caseId,
          title: rc.title,
          steps: (rc.steps || []) as any,
        })),
      }),
      '',
      QA_RESULT_JSON_CONTRACT,
    ].join('\n')

    await db
      .update(schema.tasks)
      .set({
        description,
        agentAssigneeId: agentId,
        assigneeType: 'agent',
        assigneeId: null,
        agentEnabled: true,
      })
      .where(eq(schema.tasks.id, taskId))
  }

  await db
    .update(schema.qaRuns)
    .set({
      taskId,
      agentId,
      targetUrl,
      runtime: (agent.runtime === 'opencode' ? 'opencode' : 'cursor') as 'cursor' | 'opencode',
      status: 'running',
      startedAt: new Date(),
    })
    .where(eq(schema.qaRuns.id, runId))

  return {
    ...(await getQaRunDetail(runId)),
    taskId,
    executeStarted: false,
  }
})
