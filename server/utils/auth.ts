import { getServerSession } from '#auth'
import { eq } from 'drizzle-orm'
import { getDb, schema } from '~/server/database'

export async function requireAuth(event: any) {
  const session = await getServerSession(event)
  const user = (session as any)?.user
  if (!user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return user as { id: string; email: string; name: string; role?: string }
}

export async function requireSuperAdmin(event: any) {
  const user = await requireAuth(event)
  if (user.role !== 'super_admin') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: super admin access required' })
  }
  return user
}

export async function requireWorkspaceAccess(event: any, workspaceId: string) {
  const user = await requireAuth(event)
  const db = getDb()

  const member = await db.query.workspaceMembers.findFirst({
    where: (wm, { and, eq }) =>
      and(eq(wm.workspaceId, workspaceId), eq(wm.userId, user.id)),
  })

  if (!member) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return { user, member }
}

export async function requireProjectAccess(event: any, projectId: string) {
  const user = await requireAuth(event)
  const db = getDb()

  const project = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, projectId),
    with: { workspace: true },
  })

  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  // Check if user is member of the workspace
  const wsMember = await db.query.workspaceMembers.findFirst({
    where: (wm, { and, eq }) =>
      and(eq(wm.workspaceId, project.workspaceId), eq(wm.userId, user.id)),
  })

  if (!wsMember) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return { user, project, workspace: project.workspace }
}
