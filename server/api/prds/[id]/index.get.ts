import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const prd = await db.query.prds.findFirst({
    where: eq(schema.prds.id, id),
    with: {
      sections: true,
      brainstorm: true,
    },
  })

  if (!prd) {
    throw createError({ statusCode: 404, statusMessage: 'PRD not found' })
  }

  return prd
})
