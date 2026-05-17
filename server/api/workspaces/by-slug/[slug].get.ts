import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { slug } = getRouterParams(event)
  const user = await requireAuth(event)
  const db = getDb()

  const workspace = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.slug, slug),
  })

  if (!workspace) {
    throw createError({ statusCode: 404, statusMessage: 'Workspace not found' })
  }

  // Check membership
  const member = await db.query.workspaceMembers.findFirst({
    where: (wm, { and }) =>
      and(eq(wm.workspaceId, workspace.id), eq(wm.userId, user.id)),
  })

  if (!member) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return {
    ...workspace,
    membership: {
      dismissedPrompts: member.dismissedPrompts || [],
    },
  }
})
