import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, writeFileSync } from 'fs'
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

function extractRepoName(url: string): string {
  const match = url.match(/\/([^/]+?)(\.git)?$/)
  return match ? match[1] : 'repo'
}

const projectsDir = `${process.env.HOME || '/Users/zeinersyad'}/orbit-projects`

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)

  const db = getDb()
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    columns: { id: true, title: true, description: true, projectId: true, repositoryId: true },
  })

  if (!task) throw createError({ statusCode: 404, statusMessage: 'Task not found' })

  let repoUrl = ''
  let repoDefaultBranch = 'main'
  let repoName = ''

  if (task.repositoryId) {
    const repo = await db.query.repositories.findFirst({
      where: eq(schema.repositories.id, task.repositoryId),
    })
    if (repo) {
      repoUrl = repo.url
      repoDefaultBranch = repo.defaultBranch || 'main'
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
        repoDefaultBranch = workspaceRepos[0].defaultBranch || 'main'
        repoName = workspaceRepos[0].name
      }
    }
  }

  if (!repoUrl) {
    throw createError({ statusCode: 400, statusMessage: 'No repository configured for this task' })
  }

  const repoDir = `${projectsDir}/${repoName || extractRepoName(repoUrl)}`

  if (!existsSync(repoDir)) {
    throw createError({ statusCode: 400, statusMessage: 'Repository not cloned yet. Run the agent first.' })
  }

  const branch = sanitizeBranchName(task.title)
  const prTitle = task.title

  async function getDiffSummary(repoDir: string): Promise<string> {
    try {
      const { stdout: diffOutput } = await execAsync('git diff HEAD', { cwd: repoDir })
      const { stdout: diffStat } = await execAsync('git diff --stat HEAD', { cwd: repoDir })

      if (!diffStat.trim()) return ''

      const files: { path: string; additions: string[]; deletions: number }[] = []
      let currentFile: typeof files[0] | null = null

      for (const line of diffOutput.split('\n')) {
        const fileMatch = line.match(/^diff --git a\/(.+?) b\/(.+?)$/)
        if (fileMatch) {
          if (currentFile) files.push(currentFile)
          currentFile = { path: fileMatch[2], additions: [], deletions: 0 }
          continue
        }
        if (currentFile) {
          if (line.startsWith('+') && !line.startsWith('+++') && !/^\+\s*$/.test(line) && !/^\+import\s/.test(line) && !/^\+\/\/\s/.test(line)) {
            const clean = line.slice(1).trim()
            if (clean && !clean.startsWith('}') && !clean.startsWith('{')) {
              currentFile.additions.push(clean)
            }
          }
          if (line.startsWith('-') && !line.startsWith('---') && !/^\-\s*$/.test(line)) {
            currentFile.deletions++
          }
        }
      }
      if (currentFile) files.push(currentFile)

      let summary = '## Summary\n\n'
      summary += `This PR implements **${task.title}**.`

      if (task.description) {
        summary += `\n\n${task.description}`
      }

      summary += '\n\n## Changes\n'
      for (const file of files) {
        summary += `\n### \`${file.path}\`\n`
        if (file.additions.length > 0) {
          summary += '\n**Added:**\n'
          for (const add of file.additions.slice(0, 10)) {
            summary += `- ${add}\n`
          }
          if (file.additions.length > 10) {
            summary += `- _... and ${file.additions.length - 10} more changes_\n`
          }
        }
        if (file.deletions > 0) {
          summary += `\n**Removed:** ${file.deletions} line${file.deletions > 1 ? 's' : ''}\n`
        }
      }

      summary += `\n## Files Changed\n\`\`\`\n${diffStat.trim()}\n\`\`\``

      return summary
    } catch {
      return ''
    }
  }

  let prBody = await getDiffSummary(repoDir)

  const { stdout: status } = await execAsync('git status --porcelain', { cwd: repoDir })
  if (!status.trim()) {
    return { url: null, noChanges: true }
  }

  try {
    await execAsync(`git checkout -b ${branch} 2>/dev/null || git checkout ${branch}`, { cwd: repoDir })
    await execAsync('git add -A', { cwd: repoDir })
    await execAsync(`git commit -m "${prTitle.replace(/"/g, '\\"')}"`, { cwd: repoDir })
    await execAsync(`git push origin --delete ${branch} 2>/dev/null; true`, { cwd: repoDir })
    await execAsync(`git push -u origin ${branch} 2>/dev/null || git push --force -u origin ${branch}`, { cwd: repoDir })

    // Check if PR already exists for this branch
    let existingPrUrl = ''
    try {
      const { stdout: existing } = await execAsync(
        `gh pr view ${branch} --json url --jq '.url // empty' 2>/dev/null || true`,
        { cwd: repoDir }
      )
      existingPrUrl = existing.trim()
    } catch {}

    if (existingPrUrl) {
      // PR already exists — just update the body with new diff summary
      if (prBody) {
        writeFileSync('/tmp/pr-body.md', prBody, 'utf-8')
        try {
          await execAsync(`gh pr edit ${branch} --body-file /tmp/pr-body.md`, { cwd: repoDir })
        } catch {}
      }
      try {
        await db.insert(schema.activityLogs).values({
          taskId: id,
          userId: user.id,
          action: 'pr_updated',
          newValue: { url: existingPrUrl, branch },
        })
      } catch {}
      return { url: existingPrUrl, branch }
    }

    if (prBody) {
      writeFileSync('/tmp/pr-body.md', prBody, 'utf-8')
    }
    const bodyFlag = prBody ? '--body-file /tmp/pr-body.md' : ''
    const { stdout } = await execAsync(
      `gh pr create --title "${prTitle.replace(/"/g, '\\"')}" ${bodyFlag} --base ${repoDefaultBranch || 'main'} --head ${branch}`,
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
