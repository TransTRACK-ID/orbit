import { and, eq, inArray } from 'drizzle-orm'
import { getDb, schema } from '~/server/database'
import type { QaCaseStep } from '~/server/database/schema/qa-cases'
import { getAgentInsightsForTask } from '~/server/utils/agent-task-insights'

export type CreateQaRunInput = {
  projectId: string
  planId?: string | null
  caseIds?: string[]
  taskId?: string | null
  agentId?: string | null
  targetUrl?: string | null
  runtime?: 'cursor' | 'opencode'
}

export async function createQaRunWithSnapshot(input: CreateQaRunInput) {
  const db = getDb()
  const {
    projectId,
    planId = null,
    caseIds,
    taskId = null,
    agentId = null,
    targetUrl = null,
    runtime = 'cursor',
  } = input

  let casesToSnapshot: Array<{
    id: string
    title: string
    preconditions: string | null
    steps: QaCaseStep[]
    sortOrder: number
  }> = []

  if (planId) {
    const planCases = await db.query.qaPlanCases.findMany({
      where: eq(schema.qaPlanCases.planId, planId),
      orderBy: (pc, { asc: a }) => [a(pc.sortOrder)],
      with: { case: true },
    })
    casesToSnapshot = planCases
      .filter((pc) => pc.case && pc.case.projectId === projectId)
      .map((pc, idx) => ({
        id: pc.case!.id,
        title: pc.case!.title,
        preconditions: pc.case!.preconditions ?? null,
        steps: (pc.case!.steps || []) as QaCaseStep[],
        sortOrder: pc.sortOrder ?? idx,
      }))
  } else if (caseIds && caseIds.length > 0) {
    const cases = await db.query.qaCases.findMany({
      where: and(
        eq(schema.qaCases.projectId, projectId),
        inArray(schema.qaCases.id, caseIds),
      ),
    })
    const byId = new Map(cases.map((c) => [c.id, c]))
    casesToSnapshot = caseIds
      .map((id, idx) => {
        const c = byId.get(id)
        if (!c) return null
        return {
          id: c.id,
          title: c.title,
          preconditions: c.preconditions ?? null,
          steps: (c.steps || []) as QaCaseStep[],
          sortOrder: idx,
        }
      })
      .filter(Boolean) as typeof casesToSnapshot
  }

  if (casesToSnapshot.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'At least one case is required to start a run' })
  }

  const [run] = await db
    .insert(schema.qaRuns)
    .values({
      projectId,
      planId,
      taskId,
      agentId,
      targetUrl,
      runtime,
      status: 'pending',
    })
    .returning()

  await db.insert(schema.qaRunCases).values(
    casesToSnapshot.map((c) => ({
      runId: run.id,
      caseId: c.id,
      title: c.title,
      preconditions: c.preconditions,
      steps: c.steps,
      sortOrder: c.sortOrder,
      status: 'pending' as const,
    })),
  )

  return getQaRunDetail(run.id)
}

export async function getQaRunDetail(runId: string) {
  const db = getDb()
  const run = await db.query.qaRuns.findFirst({
    where: eq(schema.qaRuns.id, runId),
    with: {
      plan: true,
      agent: true,
      project: {
        columns: { id: true, name: true, color: true },
      },
      runCases: {
        orderBy: (rc, { asc: a }) => [a(rc.sortOrder)],
        with: {
          attachments: {
            orderBy: (a, { asc: ascFn }) => [ascFn(a.createdAt)],
          },
        },
      },
    },
  })

  if (!run) {
    throw createError({ statusCode: 404, statusMessage: 'QA run not found' })
  }

  const total = run.runCases?.length || 0
  const passed = run.runCases?.filter((c) => c.status === 'passed').length || 0
  const failed = run.runCases?.filter((c) => c.status === 'failed' || c.status === 'blocked').length || 0

  const agentExecution = run.taskId
    ? await getAgentInsightsForTask(run.taskId)
    : null

  return {
    ...run,
    agentExecution,
    _totalCount: total,
    _passedCount: passed,
    _failedCount: failed,
  }
}

export async function listProjectQaRuns(projectId: string) {
  const db = getDb()
  const runs = await db.query.qaRuns.findMany({
    where: eq(schema.qaRuns.projectId, projectId),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
    with: {
      plan: true,
      agent: true,
      runCases: {
        columns: { id: true, status: true },
      },
    },
  })

  return runs.map((run) => {
    const total = run.runCases?.length || 0
    const passed = run.runCases?.filter((c) => c.status === 'passed').length || 0
    const failed = run.runCases?.filter((c) => c.status === 'failed' || c.status === 'blocked').length || 0
    const { runCases: _rc, ...rest } = run
    return {
      ...rest,
      _totalCount: total,
      _passedCount: passed,
      _failedCount: failed,
    }
  })
}

export function deriveRunStatusFromCases(
  caseStatuses: string[],
): 'pending' | 'running' | 'passed' | 'failed' | 'blocked' | 'cancelled' {
  if (caseStatuses.length === 0) return 'pending'
  if (caseStatuses.every((s) => s === 'pending')) return 'pending'
  if (caseStatuses.some((s) => s === 'pending')) return 'running'
  if (caseStatuses.some((s) => s === 'failed')) return 'failed'
  if (caseStatuses.some((s) => s === 'blocked')) return 'blocked'
  if (caseStatuses.every((s) => s === 'passed' || s === 'skipped')) return 'passed'
  return 'running'
}

export async function finishQaRun(
  runId: string,
  opts: { status?: string; summary?: string | null } = {},
) {
  const db = getDb()
  const run = await db.query.qaRuns.findFirst({
    where: eq(schema.qaRuns.id, runId),
    with: { runCases: true },
  })
  if (!run) {
    throw createError({ statusCode: 404, statusMessage: 'QA run not found' })
  }

  const status = opts.status
    || deriveRunStatusFromCases((run.runCases || []).map((c) => c.status))

  const [updated] = await db
    .update(schema.qaRuns)
    .set({
      status,
      summary: opts.summary !== undefined ? opts.summary : run.summary,
      finishedAt: new Date(),
    })
    .where(eq(schema.qaRuns.id, runId))
    .returning()

  return updated
}

export function buildQaRunTaskDescription(opts: {
  runId: string
  targetUrl: string | null
  cases: Array<{
    caseId: string | null
    title: string
    preconditions?: string | null
    steps: QaCaseStep[]
  }>
}): string {
  const uniquePreconditions = [
    ...new Set(
      opts.cases
        .map((c) => c.preconditions?.trim())
        .filter((p): p is string => !!p),
    ),
  ]

  const preconditionsBlock = uniquePreconditions.length
    ? `## Prerequisites\n\n${uniquePreconditions.join('\n\n')}\n\n`
    : ''

  const casesBlock = opts.cases.map((c, idx) => {
    const steps = (c.steps || [])
      .map((s) => `  ${s.order || idx + 1}. Action: ${s.action}\n     Expected: ${s.expected}`)
      .join('\n')
    const casePreconditions = c.preconditions?.trim()
    const preconditionsLine = casePreconditions
      ? `- Preconditions: ${casePreconditions}\n`
      : ''
    return `### Case ${idx + 1}: ${c.title}\n- caseId: ${c.caseId || 'n/a'}\n${preconditionsLine}${steps || '  (no steps)'}`
  }).join('\n\n')

  return `QA Run ID: ${opts.runId}
Target URL: ${opts.targetUrl || '(not set)'}

${preconditionsBlock}Execute each case in order using Chrome DevTools MCP. Record results in a fenced \`\`\`json qa-result block (see QA result contract). End with a plain-text message that includes \`[ORBIT_STATUS: review]\` so this QA task leaves In Progress.

## Cases

${casesBlock}`
}
