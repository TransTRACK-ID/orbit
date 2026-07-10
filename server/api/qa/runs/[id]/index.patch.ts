import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { updateQaRunSchema } from '~/server/utils/validation'
import { getQaRunDetail } from '~/server/utils/qa-runs'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const db = getDb()

  const existing = await db.query.qaRuns.findFirst({
    where: eq(schema.qaRuns.id, id),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'QA run not found' })
  }

  await requireProjectAccess(event, existing.projectId)
  const body = await readValidatedBody(event, updateQaRunSchema.parse)

  const patch: Record<string, unknown> = { ...body }
  if (body.startedAt !== undefined) {
    patch.startedAt = body.startedAt ? new Date(body.startedAt) : null
  }
  if (body.finishedAt !== undefined) {
    patch.finishedAt = body.finishedAt ? new Date(body.finishedAt) : null
  }

  await db.update(schema.qaRuns).set(patch).where(eq(schema.qaRuns.id, id))
  return getQaRunDetail(id)
})
