import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const patchSchema = z.object({
  archived: z.boolean().optional(),
  title: z.string().min(1).max(255).optional(),
})

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)
  const db = getDb()

  // Find brainstorm
  const brainstorm = await db.query.brainstorms.findFirst({
    where: eq(schema.brainstorms.id, id),
    with: {
      workspace: true,
    },
  })

  if (!brainstorm) {
    throw createError({ statusCode: 404, statusMessage: 'Brainstorm not found' })
  }

  // Verify workspace membership
  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(schema.workspaceMembers.workspaceId, brainstorm.workspaceId),
  })
  if (!membership || membership.userId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid body', data: parsed.error.flatten() })
  }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.archived !== undefined) {
    updateData.archived = parsed.data.archived
  }
  if (parsed.data.title !== undefined) {
    updateData.title = parsed.data.title
  }

  const [updated] = await db
    .update(schema.brainstorms)
    .set(updateData)
    .where(eq(schema.brainstorms.id, id))
    .returning()

  return updated
})
