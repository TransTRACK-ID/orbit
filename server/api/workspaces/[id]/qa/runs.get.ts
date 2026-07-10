import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, desc, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id: workspaceId } = getRouterParams(event)
  await requireWorkspaceAccess(event, workspaceId)
  const db = getDb()

  const projects = await db.query.projects.findMany({
    where: eq(schema.projects.workspaceId, workspaceId),
    columns: { id: true, name: true, color: true },
  })
  if (projects.length === 0) return []

  const projectIds = projects.map((p) => p.id)
  const runs = await db.query.qaRuns.findMany({
    where: inArray(schema.qaRuns.projectId, projectIds),
    orderBy: [desc(schema.qaRuns.createdAt)],
    limit: 50,
    with: {
      plan: true,
      agent: true,
      project: {
        columns: { id: true, name: true, color: true },
      },
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
})
