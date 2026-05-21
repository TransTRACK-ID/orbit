import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { logActivityFeed } from '~/server/utils/activity'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)
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

  // Log to workspace activity feed (only for user messages)
  if (body.role === 'user') {
    const brainstorm = await db.query.brainstorms.findFirst({
      where: eq(schema.brainstorms.id, id),
    })
    if (brainstorm) {
      await logActivityFeed({
        workspaceId: brainstorm.workspaceId,
        userId: user.id,
        action: 'brainstorm_message',
        entityType: 'brainstorm',
        entityId: id,
        entityName: brainstorm.title,
        message: `added a message to brainstorm "${brainstorm.title}"`,
      })
    }
  }

  return message
})
