import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { createWorkspaceSchema } from '~/server/utils/validation'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, createWorkspaceSchema.parse)
  const db = getDb()

  // Check slug uniqueness
  const existing = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.slug, body.slug),
  })

  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'A workspace with this slug already exists',
    })
  }

  // Create workspace
  const [workspace] = await db
    .insert(schema.workspaces)
    .values({
      name: body.name,
      slug: body.slug,
      description: body.description || null,
      ownerId: user.id,
    })
    .returning()

  // Add owner as member
  await db.insert(schema.workspaceMembers).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: 'owner',
  })

  return workspace
})
