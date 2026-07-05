import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { logActivityFeed } from '~/server/utils/activity'
import { enrichBrainstorm, resolveBrainstormMode } from '~/server/utils/grill-mode'
import { canSendGrillUserMessage, processGrillUserAnswer } from '~/server/utils/grill-state'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)
  const db = getDb()

  const body = await readBody<{ role: 'user' | 'assistant'; content: string }>(event)

  if (!body.content?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Content is required' })
  }

  if (body.role === 'assistant') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Use POST /api/brainstorms/:id/messages/assistant for assistant messages',
    })
  }

  const brainstorm = await db.query.brainstorms.findFirst({
    where: eq(schema.brainstorms.id, id),
  })

  if (!brainstorm) {
    throw createError({ statusCode: 404, statusMessage: 'Brainstorm not found' })
  }

  const enriched = enrichBrainstorm(brainstorm)
  const grillCheck = canSendGrillUserMessage(enriched)
  if (!grillCheck.allowed) {
    throw createError({ statusCode: 409, statusMessage: grillCheck.reason || 'Cannot send message in current grill state' })
  }

  const [message] = await db.insert(schema.brainstormMessages)
    .values({
      brainstormId: id,
      role: 'user',
      content: body.content.trim(),
    })
    .returning()

  if (resolveBrainstormMode(brainstorm) === 'grill') {
    await processGrillUserAnswer(db, enriched, body.content.trim())
  }

  await logActivityFeed({
    workspaceId: brainstorm.workspaceId,
    userId: user.id,
    action: 'brainstorm_message',
    entityType: 'brainstorm',
    entityId: id,
    entityName: enriched.displayTitle,
    message: `added a message to brainstorm "${enriched.displayTitle}"`,
  })

  const updatedBrainstorm = await db.query.brainstorms.findFirst({
    where: eq(schema.brainstorms.id, id),
  })

  return {
    message,
    brainstorm: updatedBrainstorm ? enrichBrainstorm(updatedBrainstorm) : enriched,
  }
})
