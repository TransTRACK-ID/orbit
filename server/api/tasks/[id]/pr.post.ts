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
  const user = await requireAuth(event)

  const db = getDb()
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    columns: { id: true, title: true, description: true, projectId: true },
  })

  if (!task) throw createError({ statusCode: 404, statusMessage: 'Task not found' })

  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, task.projectId),
    columns: { workspaceId: true },
  })

  if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

  const workspace = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.id, project.workspaceId),
    columns: { repositoryUrl: true, defaultBranch: true, name: true },
  })

  if (!workspace || !workspace.repositoryUrl) {
    throw createError({ statusCode: 400, statusMessage: 'No repository configured for this workspace' })
  }

  const repoDir = `${projectsDir}/${workspace.name || 'repo'}`

  if (!existsSync(repoDir)) {
    throw createError({ statusCode: 400, statusMessage: 'Repository not cloned yet. Run the agent first.' })
  }

  const branch = sanitizeBranchName(task.title)
  const prTitle = task.title
  const prBody = task.description || ''

  try {
    await execAsync(`git checkout -b ${branch} 2>/dev/null || git checkout ${branch}`, { cwd: repoDir })
    await execAsync('git add -A', { cwd: repoDir })
    await execAsync(`git commit -m "${prTitle.replace(/"/g, '\\"')}" 2>/dev/null; true`, { cwd: repoDir })
    await execAsync(`git push origin --delete ${branch} 2>/dev/null; true`, { cwd: repoDir })
    await execAsync(`git push -u origin ${branch} 2>/dev/null || git push --force -u origin ${branch}`, { cwd: repoDir })

    const bodyFlag = prBody ? `--body "${prBody.replace(/"/g, '\\"')}"` : ''
    const { stdout } = await execAsync(
      `gh pr create --title "${prTitle.replace(/"/g, '\\"')}" ${bodyFlag} --base ${workspace.defaultBranch || 'main'} --head ${branch}`,
      { cwd: repoDir }
    )

    const prUrl = stdout.trim()
    try {
      await db.insert(schema.activityLogs).values({
        taskId: id,
        userId: user.id,
        action: 'pr_created',
        newValue: { url: prUrl, branch },
      })
    } catch {}

    return { url: prUrl, branch }
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: `PR creation failed: ${err.message}` })
  }
})
