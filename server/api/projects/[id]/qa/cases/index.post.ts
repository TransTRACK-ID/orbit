import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { createQaCaseSchema } from '~/server/utils/validation'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id: projectId } = getRouterParams(event)
  await requireProjectAccess(event, projectId)
  const body = await readValidatedBody(event, createQaCaseSchema.parse)
  const db = getDb()

  if (body.suiteId) {
    const suite = await db.query.qaSuites.findFirst({
      where: eq(schema.qaSuites.id, body.suiteId),
    })
    if (!suite || suite.projectId !== projectId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid suite' })
    }
  }

  const [qaCase] = await db
    .insert(schema.qaCases)
    .values({
      projectId,
      suiteId: body.suiteId ?? null,
      title: body.title,
      preconditions: body.preconditions ?? null,
      steps: body.steps ?? [],
      priority: body.priority ?? 'medium',
      status: body.status ?? 'active',
      sortOrder: body.sortOrder ?? 0,
    })
    .returning()

  return qaCase
})
