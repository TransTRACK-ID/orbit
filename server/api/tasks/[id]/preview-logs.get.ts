import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { getPreviewLogs } from '~/server/utils/preview-orchestrator'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { id } = getRouterParams(event)

  const db = getDb()

  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    with: {
      repository: true,
      project: { with: { workspace: true } },
    },
  })

  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  const member = await db.query.workspaceMembers.findFirst({
    where: (wm, { and, eq }) =>
      and(eq(wm.workspaceId, task.project.workspaceId), eq(wm.userId, user.id)),
  })

  if (!member) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const instance = await db.query.previewInstances.findFirst({
    where: eq(schema.previewInstances.taskId, task.id),
    orderBy: (instances, { desc }) => [desc(instances.createdAt)],
  })

  if (!instance) {
    return {
      logs: [],
      ready: false,
      failed: false,
      failReason: null,
      mode: 'build',
    }
  }

  return {
    logs: instance.logs,
    ready: instance.status === 'running',
    failed: instance.status === 'failed',
    failReason: instance.failReason,
    mode: instance.mode,
  }
})
