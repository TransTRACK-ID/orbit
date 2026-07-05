import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { logActivityFeed } from '~/server/utils/activity'
import { encodeGrillTitle, enrichBrainstorm } from '~/server/utils/grill-mode'
import { eq } from 'drizzle-orm'
import type { BrainstormMode } from '~/types'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)
  const db = getDb()

  // Verify workspace membership
  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(schema.workspaceMembers.workspaceId, id),
  })
  if (!membership || membership.userId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody<{
    title: string
    repositoryId?: string | null
    mode?: BrainstormMode
    initialPlan?: string
  }>(event)

  if (!body.title?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required' })
  }

  const mode = body.mode === 'grill' ? 'grill' : 'chat'
  const displayTitle = body.title.trim()
  const storedTitle = mode === 'grill' ? encodeGrillTitle(displayTitle) : displayTitle

  if (mode === 'grill' && !body.initialPlan?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Initial plan is required for grill sessions' })
  }

  const [brainstorm] = await db.insert(schema.brainstorms)
    .values({
      workspaceId: id,
      repositoryId: body.repositoryId || null,
      title: storedTitle,
    })
    .returning()

  if (mode === 'grill' && body.initialPlan?.trim()) {
    await db.insert(schema.brainstormMessages).values({
      brainstormId: brainstorm.id,
      role: 'user',
      content: body.initialPlan.trim(),
    })
  }

  await logActivityFeed({
    workspaceId: id,
    userId: user.id,
    action: 'brainstorm_created',
    entityType: 'brainstorm',
    entityId: brainstorm.id,
    entityName: displayTitle,
    message: mode === 'grill'
      ? `created grill-me session "${displayTitle}"`
      : `created brainstorm "${displayTitle}"`,
  })

  return enrichBrainstorm(brainstorm)
})
