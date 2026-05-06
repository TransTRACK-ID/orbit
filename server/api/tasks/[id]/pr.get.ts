import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

const execAsync = promisify(exec)

function sanitizeBranchName(title: string): string {
  return 'task-'
    + title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50)
}

const projectsDir = `${process.env.HOME || '/Users/zeinersyad'}/orbit-projects`

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)

  const db = getDb()
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    columns: { id: true, title: true, projectId: true },
  })

  if (!task) throw createError({ statusCode: 404, statusMessage: 'Task not found' })

  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, task.projectId),
    columns: { workspaceId: true },
  })

  if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

  const workspace = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.id, project.workspaceId),
    columns: { repositoryUrl: true, name: true },
  })

  if (!workspace || !workspace.repositoryUrl) {
    return { url: null }
  }

  const repoDir = `${projectsDir}/${workspace.name || 'repo'}`
  if (!existsSync(repoDir)) {
    return { url: null }
  }

  const branch = sanitizeBranchName(task.title)

  try {
    const { stdout } = await execAsync(
      `gh pr list --head "${branch}" --json url --jq '.[0].url // empty'`,
      { cwd: repoDir }
    )
    const url = stdout.trim() || null
    return { url }
  } catch {
    return { url: null }
  }
})
