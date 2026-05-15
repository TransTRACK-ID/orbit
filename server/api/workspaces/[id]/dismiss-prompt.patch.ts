import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const workspaceId = getRouterParam(event, 'id')
  const { promptKey } = await readBody(event)

  if (!workspaceId || !promptKey) {
    throw createError({ statusCode: 400, statusMessage: 'Missing workspaceId or promptKey' })
  }

  const db = getDb()

  const member = await db.query.workspaceMembers.findFirst({
    where: (wm, { and }) =>
      and(eq(wm.workspaceId, workspaceId), eq(wm.userId, user.id)),
  })

  if (!member) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const current = member.dismissedPrompts || []
  if (!current.includes(promptKey)) {
    await db
      .update(schema.workspaceMembers)
      .set({
        dismissedPrompts: [...current, promptKey],
      })
      .where(and(
        eq(schema.workspaceMembers.workspaceId, workspaceId),
        eq(schema.workspaceMembers.userId, user.id),
      ))
  }

  return { success: true }
})
