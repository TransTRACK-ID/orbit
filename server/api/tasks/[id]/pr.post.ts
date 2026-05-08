import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { getDiffSummary } from '~/server/utils/git-summary'

const execAsync = promisify(exec)

function sanitizeBranchName(title: string): string {
  return 'task-'
    + title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50)
}

function shEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
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

  let prBody = await getDiffSummary(repoDir, repoDefaultBranch, task.title, task.description)

  const { stdout: status } = await execAsync('git status --porcelain', { cwd: repoDir })
  const hasUncommitted = !!status.trim()

  let hasCommittedChanges = false
  if (!hasUncommitted) {
    try {
      await execAsync(`git fetch origin ${repoDefaultBranch} 2>/dev/null`, { cwd: repoDir })
      const { stdout: ahead } = await execAsync(
        `git rev-list --count HEAD ^origin/${repoDefaultBranch} 2>/dev/null || echo "0"`,
        { cwd: repoDir }
      )
      hasCommittedChanges = parseInt(ahead.trim()) > 0
    } catch {}
  }

  if (!hasUncommitted && !hasCommittedChanges) {
    return { url: null, noChanges: true }
  }

  try {
    await execAsync(`git checkout -b ${branch} 2>/dev/null || git checkout ${branch}`, { cwd: repoDir })
    if (hasUncommitted) {
      await execAsync('git add -A', { cwd: repoDir })
      await execAsync(`git commit -m "${prTitle.replace(/"/g, '\\"')}"`, { cwd: repoDir })
    }
    await execAsync(`git push origin --delete ${branch} 2>/dev/null; true`, { cwd: repoDir })
    await execAsync(`git push -u origin ${branch} 2>/dev/null || git push --force -u origin ${branch}`, { cwd: repoDir })

    let cli = 'gh'
    let gitlabHost = ''
    try {
      const { stdout: remotes } = await execAsync('git remote -v', { cwd: repoDir })
      if (remotes.includes('gitlab')) {
        cli = 'glab'
      }
    } catch {}

    if (cli === 'gh') {
      try {
        await execAsync('gh repo view >/dev/null 2>&1', { cwd: repoDir })
      } catch {
        try {
          await execAsync('glab repo view >/dev/null 2>&1', { cwd: repoDir })
          cli = 'glab'
        } catch {
          if (repoUrl && !repoUrl.includes('github.com')) {
            cli = 'glab'
          }
        }
      }
    }

    // For self-hosted GitLab: extract host and set GITLAB_HOST so glab knows where to connect
    if (cli === 'glab') {
      try {
        const { stdout: remoteUrl } = await execAsync('git remote get-url origin', { cwd: repoDir })
        const match = remoteUrl.trim().match(/^(https?:\/\/[^\/]+)/)
        if (match && !match[1].includes('github.com')) {
          gitlabHost = match[1]
        }
      } catch {}
    }

    const gitlabEnv = gitlabHost ? { ...process.env, GITLAB_HOST: gitlabHost } : process.env

    // Check if PR/MR already exists for this branch
    let existingPrUrl = ''
    try {
      if (cli === 'glab') {
        const { stdout: existing } = await execAsync(
          `glab mr view ${branch} -F json 2>/dev/null | jq -r '.web_url // empty' || true`,
          { cwd: repoDir, env: gitlabEnv }
        )
        existingPrUrl = existing.trim()
        if (existingPrUrl === 'null' || !existingPrUrl) existingPrUrl = ''
      } else {
        const { stdout: existing } = await execAsync(
          `gh pr view ${branch} --json url --jq '.url // empty' 2>/dev/null || true`,
          { cwd: repoDir }
        )
        existingPrUrl = existing.trim()
      }
    } catch {}

    if (existingPrUrl) {
      if (prBody) {
        writeFileSync('/tmp/pr-body.md', prBody, 'utf-8')
        try {
          if (cli === 'glab') {
            const bodyContent = readFileSync('/tmp/pr-body.md', 'utf-8')
            await execAsync(`glab mr update ${branch} --description ${shEscape(bodyContent)}`, { cwd: repoDir, env: gitlabEnv })
          } else {
            await execAsync(`gh pr edit ${branch} --body-file /tmp/pr-body.md`, { cwd: repoDir })
          }
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
    
    let prUrl = ''
    let lastError = ''
    if (cli === 'glab') {
      const bodyArg = prBody ? `--description ${shEscape(readFileSync('/tmp/pr-body.md', 'utf-8'))}` : ''
      const { stdout, stderr } = await execAsync(
        `glab mr create --title "${prTitle.replace(/"/g, '\\"')}" ${bodyArg} --target-branch ${repoDefaultBranch || 'main'} --source-branch ${branch} -y 2>&1 || true`,
        { cwd: repoDir, env: gitlabEnv }
      )
      const output = (stdout + stderr).trim()
      const urlMatch = output.match(/https?:\/\/[^\s]+/)
      prUrl = urlMatch ? urlMatch[0] : ''
      if (!prUrl) lastError = output.slice(0, 300)

      if (!prUrl) {
        const { stdout: fallback } = await execAsync(
          `glab mr view ${branch} -F json 2>/dev/null | jq -r '.web_url // empty' || true`,
          { cwd: repoDir, env: gitlabEnv }
        )
        prUrl = fallback.trim()
        if (prUrl === 'null' || prUrl === '') {
          prUrl = ''
          if (!lastError) lastError = (output || fallback).slice(0, 300)
        }
      }
    } else {
      const bodyFlag = prBody ? '--body-file /tmp/pr-body.md' : ''
      const { stdout, stderr } = await execAsync(
        `gh pr create --title "${prTitle.replace(/"/g, '\\"')}" ${bodyFlag} --base ${repoDefaultBranch || 'main'} --head ${branch}`,
        { cwd: repoDir }
      )
      prUrl = (stdout + stderr).trim()
    }

    if (!prUrl) {
      throw createError({ statusCode: 500, statusMessage: `Failed to create PR/MR. ${lastError || 'Check that the CLI is installed and authenticated.'}` })
    }

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
