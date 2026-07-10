import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { updateQaCaseSchema } from '~/server/utils/validation'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const db = getDb()

  const existing = await db.query.qaCases.findFirst({
    where: eq(schema.qaCases.id, id),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Case not found' })
  }

  await requireProjectAccess(event, existing.projectId)
  const body = await readValidatedBody(event, updateQaCaseSchema.parse)

  if (body.suiteId) {
    const suite = await db.query.qaSuites.findFirst({
      where: eq(schema.qaSuites.id, body.suiteId),
    })
    if (!suite || suite.projectId !== existing.projectId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid suite' })
    }
  }

  const [updated] = await db
    .update(schema.qaCases)
    .set(body)
    .where(eq(schema.qaCases.id, id))
    .returning()

  return updated
})
