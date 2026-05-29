import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 255)
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = getDb()

  // Check if user already has a workspace (in case of page refresh)
  const existingWorkspace = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.ownerId, user.id),
  })

  if (existingWorkspace) {
    return existingWorkspace
  }

  // Generate workspace name from user name or email
  const workspaceName = user.name || user.email.split('@')[0] || 'workspace'
  const baseSlug = generateSlug(workspaceName)

  // Find unique slug by appending counter if needed
  let slug = baseSlug
  let counter = 2
  while (true) {
    const existing = await db.query.workspaces.findFirst({
      where: eq(schema.workspaces.slug, slug),
    })
    if (!existing) break
    slug = `${baseSlug}-${counter}`
    counter++
  }

  // Create workspace
  const [workspace] = await db
    .insert(schema.workspaces)
    .values({
      name: workspaceName,
      slug,
      ownerId: user.id,
    })
    .returning()

  if (!workspace) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create workspace',
    })
  }

  // Add owner as member
  await db.insert(schema.workspaceMembers).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: 'owner',
  })

  return workspace
})
