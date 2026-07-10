import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { updateQaSuiteSchema } from '~/server/utils/validation'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const db = getDb()

  const suite = await db.query.qaSuites.findFirst({
    where: eq(schema.qaSuites.id, id),
  })
  if (!suite) {
    throw createError({ statusCode: 404, statusMessage: 'Suite not found' })
  }

  await requireProjectAccess(event, suite.projectId)
  const body = await readValidatedBody(event, updateQaSuiteSchema.parse)

  if (body.parentId) {
    if (body.parentId === id) {
      throw createError({ statusCode: 400, statusMessage: 'Suite cannot be its own parent' })
    }
    const parent = await db.query.qaSuites.findFirst({
      where: eq(schema.qaSuites.id, body.parentId),
    })
    if (!parent || parent.projectId !== suite.projectId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid parent suite' })
    }
  }

  const [updated] = await db
    .update(schema.qaSuites)
    .set(body)
    .where(eq(schema.qaSuites.id, id))
    .returning()

  return updated
})
