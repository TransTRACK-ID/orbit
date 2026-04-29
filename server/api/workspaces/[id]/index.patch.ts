import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { updateWorkspaceSchema } from '~/server/utils/validation'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, updateWorkspaceSchema.parse)
  const db = getDb()

  // Verify ownership
  const workspace = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.id, id),
  })

  if (!workspace) {
    throw createError({ statusCode: 404, statusMessage: 'Workspace not found' })
  }

  if (workspace.ownerId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Only the owner can update the workspace' })
  }

  const [updated] = await db
    .update(schema.workspaces)
    .set(body)
    .where(eq(schema.workspaces.id, id))
    .returning()

  return updated
})
