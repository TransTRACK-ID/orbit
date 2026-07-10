import { requireAuth } from '~/server/utils/auth'
import { getDb } from '~/server/database'
import { enrichBrainstorm, resolveBrainstormMode } from '~/server/utils/grill-mode'
import { persistAssistantGrillMessage } from '~/server/utils/grill-state'
import { dedupeRepeatedReportSections } from '~/utils/agent-comment'
import { eq } from 'drizzle-orm'
import { schema } from '~/server/database'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const body = await readBody<{ content: string }>(event)
  if (!body.content?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Content is required' })
  }

  const content = dedupeRepeatedReportSections(body.content.trim())
  if (!content) {
    throw createError({ statusCode: 400, statusMessage: 'Content is required' })
  }

  const brainstorm = await db.query.brainstorms.findFirst({
    where: eq(schema.brainstorms.id, id),
  })

  if (!brainstorm) {
    throw createError({ statusCode: 404, statusMessage: 'Brainstorm not found' })
  }

  const mode = resolveBrainstormMode(brainstorm)
  if (mode === 'grill') {
    const result = await persistAssistantGrillMessage(db, id, content)
    return {
      message: result.message,
      brainstorm: enrichBrainstorm(result.brainstorm),
      warning: result.warning,
    }
  }

  const [message] = await db.insert(schema.brainstormMessages)
    .values({
      brainstormId: id,
      role: 'assistant',
      content,
    })
    .returning()

  return { message, brainstorm: enrichBrainstorm(brainstorm) }
})
