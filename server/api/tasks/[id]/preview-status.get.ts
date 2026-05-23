import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { getPreviewStatus } from '~/server/utils/preview-orchestrator'

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

  const instance = await getPreviewStatus(task.id)

  if (!instance) {
    return { available: false }
  }

  return {
    available: instance.status === 'running',
    starting: instance.status === 'building',
    failed: instance.status === 'failed',
    failReason: instance.failReason,
    url: instance.status === 'running' ? `/api/preview/${instance.id}` : null,
    instanceId: instance.id,
    framework: instance.framework,
    mode: instance.mode,
  }
})
