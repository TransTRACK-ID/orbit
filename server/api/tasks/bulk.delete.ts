import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, inArray, and } from 'drizzle-orm'
import { z } from 'zod'

const bulkDeleteSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, bulkDeleteSchema.parse)
  const db = getDb()

  const existingTasks = await db.query.tasks.findMany({
    where: inArray(schema.tasks.id, body.taskIds),
    with: { project: true },
  })

  if (existingTasks.length !== body.taskIds.length) {
    throw createError({ statusCode: 404, statusMessage: 'One or more tasks not found' })
  }

  const projectId = existingTasks[0].projectId
  if (!existingTasks.every((t) => t.projectId === projectId)) {
    throw createError({ statusCode: 400, statusMessage: 'Bulk delete only supported for tasks in the same project' })
  }

  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
    with: { workspace: true },
  })
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }
  const wsMember = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(schema.workspaceMembers.workspaceId, project.workspaceId),
      eq(schema.workspaceMembers.userId, user.id)
    ),
  })
  if (!wsMember) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  await db.delete(schema.tasks).where(inArray(schema.tasks.id, body.taskIds))

  return { deleted: body.taskIds.length }
})
