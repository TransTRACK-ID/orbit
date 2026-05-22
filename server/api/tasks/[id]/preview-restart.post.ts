import { existsSync } from 'fs'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { startDevServer, stopDevServer, getDevServerByTask } from '~/server/utils/dev-server-orchestrator'
import { resolveCloneDir, resolveWorktreeDir } from '~/server/utils/worktree-resolver'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { id } = getRouterParams(event)

  const db = getDb()

  // Fetch task with repository and project for access check
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

  // Verify workspace membership
  const member = await db.query.workspaceMembers.findFirst({
    where: (wm, { and, eq }) =>
      and(eq(wm.workspaceId, task.project.workspaceId), eq(wm.userId, user.id)),
  })

  if (!member) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  // Ensure task has a repository and branch
  if (!task.repository?.url) {
    throw createError({ statusCode: 400, statusMessage: 'Task has no repository' })
  }

  // Resolve worktree directory
  const cloneDir = resolveCloneDir(task.repository.url, task.repository.name)
  const worktreeDir = resolveWorktreeDir(cloneDir, task.id)

  // Check if worktree exists
  if (!existsSync(worktreeDir)) {
    throw createError({ statusCode: 400, statusMessage: 'Task worktree not found. Run the agent first.' })
  }

  // Stop existing dev server if running
  const existing = getDevServerByTask(task)
  if (existing) {
    console.log(`[preview-restart] Stopping existing dev server for task ${task.id}`)
    await stopDevServer(worktreeDir)
    // Give the OS a moment to free the port
    await new Promise(r => setTimeout(r, 1000))
  }

  // Start fresh (installs deps, clears cache, runs nuxt prepare, starts dev server)
  try {
    const devServer = await startDevServer(worktreeDir, task.repository.id || undefined, task.id)
    return {
      available: true,
      url: `/api/preview/${task.id}`,
      message: 'Preview server restarted successfully',
    }
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: `Failed to restart preview: ${err.message}` })
  }
})
