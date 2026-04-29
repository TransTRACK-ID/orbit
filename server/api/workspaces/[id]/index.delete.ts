import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)
  const db = getDb()

  const workspace = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.id, id),
  })

  if (!workspace) {
    throw createError({ statusCode: 404, statusMessage: 'Workspace not found' })
  }

  if (workspace.ownerId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Only the owner can delete the workspace' })
  }

  await db.delete(schema.workspaces).where(eq(schema.workspaces.id, id))

  return { success: true }
})
