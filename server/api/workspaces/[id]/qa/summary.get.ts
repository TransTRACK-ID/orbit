import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, desc, inArray, count } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id: workspaceId } = getRouterParams(event)
  await requireWorkspaceAccess(event, workspaceId)
  const db = getDb()

  const projects = await db.query.projects.findMany({
    where: eq(schema.projects.workspaceId, workspaceId),
    columns: { id: true },
  })
  if (projects.length === 0) {
    return { suiteCount: 0, caseCount: 0, planCount: 0, runCount: 0, recentRuns: [] }
  }

  const projectIds = projects.map((p) => p.id)

  const [suiteCount] = await db
    .select({ count: count() })
    .from(schema.qaSuites)
    .where(inArray(schema.qaSuites.projectId, projectIds))

  const [caseCount] = await db
    .select({ count: count() })
    .from(schema.qaCases)
    .where(inArray(schema.qaCases.projectId, projectIds))

  const [planCount] = await db
    .select({ count: count() })
    .from(schema.qaPlans)
    .where(inArray(schema.qaPlans.projectId, projectIds))

  const [runCount] = await db
    .select({ count: count() })
    .from(schema.qaRuns)
    .where(inArray(schema.qaRuns.projectId, projectIds))

  const recentRuns = await db.query.qaRuns.findMany({
    where: inArray(schema.qaRuns.projectId, projectIds),
    orderBy: [desc(schema.qaRuns.createdAt)],
    limit: 5,
    with: {
      project: { columns: { id: true, name: true, color: true } },
      runCases: { columns: { id: true, status: true } },
    },
  })

  return {
    suiteCount: Number(suiteCount?.count || 0),
    caseCount: Number(caseCount?.count || 0),
    planCount: Number(planCount?.count || 0),
    runCount: Number(runCount?.count || 0),
    recentRuns: recentRuns.map((run) => {
      const total = run.runCases?.length || 0
      const passed = run.runCases?.filter((c) => c.status === 'passed').length || 0
      const failed = run.runCases?.filter((c) => c.status === 'failed' || c.status === 'blocked').length || 0
      const { runCases: _rc, ...rest } = run
      return { ...rest, _totalCount: total, _passedCount: passed, _failedCount: failed }
    }),
  }
})
