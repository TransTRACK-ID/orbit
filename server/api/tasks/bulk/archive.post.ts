import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { unifyAssignee } from '~/server/utils/unify-assignee'
import { eq, inArray, and } from 'drizzle-orm'
import { z } from 'zod'

const bulkArchiveSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1),
  archived: z.boolean().default(true),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, bulkArchiveSchema.parse)
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
    throw createError({ statusCode: 400, statusMessage: 'Bulk archive only supported for tasks in the same project' })
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

  await db
    .update(schema.tasks)
    .set({ archived: body.archived, updatedAt: new Date() })
    .where(inArray(schema.tasks.id, body.taskIds))

  const updatedTasks = await db.query.tasks.findMany({
    where: inArray(schema.tasks.id, body.taskIds),
    with: {
      assignee: { columns: { id: true, email: true, name: true, avatarUrl: true } },
      agentAssignee: true,
      observer: { columns: { id: true, email: true, name: true, avatarUrl: true } },
      reporter: { columns: { id: true, email: true, name: true, avatarUrl: true } },
      status: true,
      taskLabels: { with: { label: true } },
    },
  })

  return updatedTasks.map((updated) => ({
    ...unifyAssignee(updated),
    labels: updated.taskLabels?.map((tl: any) => tl.label) || [],
    taskLabels: undefined,
  }))
})
