import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const { user: currentUser } = await requireWorkspaceAccess(event, id)

  const body = await readValidatedBody(event, z.object({
    email: z.string().email(),
    role: z.enum(['admin', 'member']).optional().default('member'),
  }).parse)

  const db = getDb()

  // Find user by email
  const invitedUser = await db.query.users.findFirst({
    where: eq(schema.users.email, body.email.toLowerCase()),
  })

  if (!invitedUser) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  // Check if already a member
  const existingMember = await db.query.workspaceMembers.findFirst({
    where: (wm, { and }) =>
      and(eq(wm.workspaceId, id), eq(wm.userId, invitedUser.id)),
  })

  if (existingMember) {
    throw createError({ statusCode: 409, statusMessage: 'User is already a member' })
  }

  const [member] = await db
    .insert(schema.workspaceMembers)
    .values({
      workspaceId: id,
      userId: invitedUser.id,
      role: body.role,
    })
    .returning()

  return { ...member, user: invitedUser }
})
