import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { createQaSuiteSchema } from '~/server/utils/validation'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id: projectId } = getRouterParams(event)
  await requireProjectAccess(event, projectId)
  const body = await readValidatedBody(event, createQaSuiteSchema.parse)
  const db = getDb()

  if (body.parentId) {
    const parent = await db.query.qaSuites.findFirst({
      where: eq(schema.qaSuites.id, body.parentId),
    })
    if (!parent || parent.projectId !== projectId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid parent suite' })
    }
  }

  const [suite] = await db
    .insert(schema.qaSuites)
    .values({
      projectId,
      name: body.name,
      parentId: body.parentId ?? null,
      sortOrder: body.sortOrder ?? 0,
    })
    .returning()

  return { ...suite, _caseCount: 0 }
})
