import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const body = await readBody<{ role: 'user' | 'assistant'; content: string }>(event)

  if (!body.content?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Content is required' })
  }

  const [message] = await db.insert(schema.brainstormMessages)
    .values({
      brainstormId: id,
      role: body.role,
      content: body.content.trim(),
    })
    .returning()

  return message
})
