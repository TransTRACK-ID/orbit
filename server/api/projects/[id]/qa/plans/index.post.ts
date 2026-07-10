import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { createQaPlanSchema } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const { id: projectId } = getRouterParams(event)
  await requireProjectAccess(event, projectId)
  const body = await readValidatedBody(event, createQaPlanSchema.parse)
  const db = getDb()

  const [plan] = await db
    .insert(schema.qaPlans)
    .values({
      projectId,
      name: body.name,
      description: body.description ?? null,
    })
    .returning()

  return { ...plan, cases: [], _caseCount: 0 }
})
