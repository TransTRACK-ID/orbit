import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { enrichBrainstorm, resolveBrainstormMode } from '~/server/utils/grill-mode'
import { extractGrillDecisionsFromMessages } from '~/utils/grill-decisions'
import { eq, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const brainstorm = await db.query.brainstorms.findFirst({
    where: eq(schema.brainstorms.id, id),
  })

  if (!brainstorm) {
    throw createError({ statusCode: 404, statusMessage: 'Brainstorm not found' })
  }

  const enriched = enrichBrainstorm(brainstorm)
  if (resolveBrainstormMode(brainstorm) !== 'grill') {
    return {
      resolved: [],
      pending: null,
      summary: null,
      isComplete: false,
    }
  }

  const messages = await db.query.brainstormMessages.findMany({
    where: eq(schema.brainstormMessages.brainstormId, id),
    orderBy: [asc(schema.brainstormMessages.createdAt)],
  })

  return extractGrillDecisionsFromMessages(messages, {
    grillStatus: enriched.grillStatus,
    currentQuestionId: enriched.currentQuestionId,
  })
})
