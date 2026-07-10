import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { updateQaRunCaseSchema } from '~/server/utils/validation'
import { deriveRunStatusFromCases } from '~/server/utils/qa-runs'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const db = getDb()

  const runCase = await db.query.qaRunCases.findFirst({
    where: eq(schema.qaRunCases.id, id),
    with: { run: true },
  })
  if (!runCase || !runCase.run) {
    throw createError({ statusCode: 404, statusMessage: 'Run case not found' })
  }

  await requireProjectAccess(event, runCase.run.projectId)
  const body = await readValidatedBody(event, updateQaRunCaseSchema.parse)

  const [updated] = await db
    .update(schema.qaRunCases)
    .set(body)
    .where(eq(schema.qaRunCases.id, id))
    .returning()

  const siblings = await db.query.qaRunCases.findMany({
    where: eq(schema.qaRunCases.runId, runCase.runId),
    columns: { status: true },
  })
  const derived = deriveRunStatusFromCases(siblings.map((s) => s.status))
  if (derived !== 'pending' && derived !== runCase.run.status) {
    const patch: Record<string, unknown> = { status: derived }
    if (['passed', 'failed', 'blocked', 'cancelled'].includes(derived)) {
      patch.finishedAt = new Date()
    } else if (derived === 'running' && !runCase.run.startedAt) {
      patch.startedAt = new Date()
    }
    await db.update(schema.qaRuns).set(patch).where(eq(schema.qaRuns.id, runCase.runId))
  }

  return updated
})
