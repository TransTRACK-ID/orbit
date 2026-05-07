import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { createProjectSchema } from '~/server/utils/validation'
import { eq } from 'drizzle-orm'

const DEFAULT_STATUSES = [
  { name: 'Backlog', color: '#94a3b8', position: 0, isDefault: true },
  { name: 'Todo', color: '#3b82f6', position: 1, isDefault: false },
  { name: 'In Progress', color: '#f59e0b', position: 2, isDefault: false },
  { name: 'Review', color: '#8b5cf6', position: 3, isDefault: false },
  { name: 'Done', color: '#22c55e', position: 4, isDefault: false },
]

export default defineEventHandler(async (event) => {
  const { id: workspaceId } = getRouterParams(event)
  const { user } = await requireWorkspaceAccess(event, workspaceId)
  const body = await readValidatedBody(event, createProjectSchema.parse)
  const db = getDb()

  // Create project
  const [project] = await db
    .insert(schema.projects)
    .values({
      workspaceId,
      name: body.name,
      description: body.description || null,
      color: body.color || '#F14848',
      icon: body.icon || null,
    })
    .returning()

  // Add creator as project member (owner)
  await db.insert(schema.projectMembers).values({
    projectId: project.id,
    userId: user.id,
    role: 'owner',
  })

  // Create default statuses
  await db.insert(schema.statuses).values(
    DEFAULT_STATUSES.map((s) => ({
      projectId: project.id,
      ...s,
    }))
  )

  return project
})
