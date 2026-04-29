import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireProjectAccess(event, id)

  const body = await readValidatedBody(event, z.object({
    userId: z.string().uuid(),
    role: z.enum(['admin', 'member']).optional().default('member'),
  }).parse)

  const db = getDb()

  // Check if user is a workspace member (they need to be in the workspace first)
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, id),
  })
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  const wsMember = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(schema.workspaceMembers.workspaceId, project.workspaceId),
      eq(schema.workspaceMembers.userId, body.userId)
    ),
  })

  if (!wsMember) {
    throw createError({ statusCode: 400, statusMessage: 'User is not a member of the workspace' })
  }

  // Check if already a project member
  const existing = await db.query.projectMembers.findFirst({
    where: and(
      eq(schema.projectMembers.projectId, id),
      eq(schema.projectMembers.userId, body.userId)
    ),
  })

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'User is already a project member' })
  }

  const [member] = await db
    .insert(schema.projectMembers)
    .values({
      projectId: id,
      userId: body.userId,
      role: body.role,
    })
    .returning()

  return member
})
