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
    columns: { id: true, title: true, projectId: true, repositoryId: true },
  })

  if (!task) throw createError({ statusCode: 404, statusMessage: 'Task not found' })

  let repoUrl = ''
  let repoName = ''

  if (task.repositoryId) {
    const repo = await db.query.repositories.findFirst({
      where: eq(schema.repositories.id, task.repositoryId),
    })
    if (repo) {
      repoUrl = repo.url
      repoName = repo.name
    }
  }

  if (!repoUrl) {
    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, task.projectId),
      columns: { workspaceId: true },
    })
    if (project) {
      const workspaceRepos = await db.query.repositories.findMany({
        where: eq(schema.repositories.workspaceId, project.workspaceId),
        limit: 1,
      })
      if (workspaceRepos[0]) {
        repoUrl = workspaceRepos[0].url
        repoName = workspaceRepos[0].name
      }
    }
  }

  if (!repoUrl) return { url: null }

  function extractRepoName(url: string): string {
    const match = url.match(/\/([^/]+?)(\.git)?$/)
    return match ? match[1] : 'repo'
  }

  const repoDir = `${projectsDir}/${repoName || extractRepoName(repoUrl)}`
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
