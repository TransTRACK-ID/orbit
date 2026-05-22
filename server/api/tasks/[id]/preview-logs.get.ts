import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { getDevServerLogs, getDevServerByTask } from '~/server/utils/dev-server-orchestrator'

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

  const devServer = getDevServerByTask(task, { includeNotReady: true })
  const logs = getDevServerLogs(devServer?.worktreeDir || '')

  return {
    logs,
    ready: devServer?.ready || false,
    failed: devServer?.failed || false,
    failReason: devServer?.failReason || null,
  }
})
