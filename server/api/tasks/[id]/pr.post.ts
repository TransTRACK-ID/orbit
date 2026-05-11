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

function sanitizeDirName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/^-+|-+$/g, '')
    || 'repo'
}

function resolveCloneDir(projectsDir: string, repoUrl: string, repoName?: string | null): string {
  const urlName = sanitizeDirName(extractRepoName(repoUrl))
  const displayName = repoName ? sanitizeDirName(repoName) : null
  const rawDisplayName = repoName ? repoName.trim() : null

  // Prefer exact display name if directory already exists (preserves existing clones)
  if (rawDisplayName) {
    const rawDisplayDir = `${projectsDir}/${rawDisplayName}`
    if (existsSync(rawDisplayDir)) return rawDisplayDir
  }

  // Try sanitized display name
  if (displayName) {
    const displayDir = `${projectsDir}/${displayName}`
    if (existsSync(displayDir)) return displayDir
  }

  // If repo was renamed in UI, scan existing directories for one with matching remote URL
  try {
    const entries = require('fs').readdirSync(projectsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const gitConfigPath = `${projectsDir}/${entry.name}/.git/config`
      if (existsSync(gitConfigPath)) {
        const config = readFileSync(gitConfigPath, 'utf-8')
        if (config.includes(`url = ${repoUrl}`) || config.includes(repoUrl)) {
          return `${projectsDir}/${entry.name}`
        }
      }
    }
  } catch {}

  // Fall back to URL-derived name
  return `${projectsDir}/${urlName}`
}

function injectTokenIntoRemoteUrl(url: string, platform: string, token?: string | null): string {
  const envToken = platform === 'github'
    ? (process.env.GITHUB_TOKEN || '')
    : (process.env.GITLAB_TOKEN || '')
  const effectiveToken = token || envToken
  if (!effectiveToken) return url

  if (platform === 'github') {
    if (!url.startsWith('https://github.com/')) return url
    return url.replace(/^https:\/\/github\.com\//, `https://${effectiveToken}@github.com/`)
  }

  if (!url.startsWith('https://')) return url
  return url.replace(/^https:\/\//, `https://oauth2:${effectiveToken}@`)
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
  let repoToken: string | null = null
  let repoPlatform: 'github' | 'gitlab' | 'gitlab-self-hosted' = 'github'

  if (task.repositoryId) {
    const repo = await db.query.repositories.findFirst({
      where: eq(schema.repositories.id, task.repositoryId),
    })
    if (repo) {
      repoUrl = repo.url
      repoDefaultBranch = repo.defaultBranch || 'main'
      repoName = repo.name
      repoToken = repo.token
      repoPlatform = (repo.platform as 'github' | 'gitlab' | 'gitlab-self-hosted') || 'github'
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
        repoToken = workspaceRepos[0].token
        repoPlatform = (workspaceRepos[0].platform as 'github' | 'gitlab' | 'gitlab-self-hosted') || 'github'
      }
    }
  }

  if (!repoUrl) {
    throw createError({ statusCode: 400, statusMessage: 'No repository configured for this task' })
  }

  const repoDir = resolveCloneDir(projectsDir, repoUrl, repoName)

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
    // Ensure we start from a clean default branch before creating the task branch
    const { stdout: branchCheck } = await execAsync(`git branch --list ${branch}`, { cwd: repoDir })
    if (!branchCheck.trim()) {
      // Branch doesn't exist yet: reset default to origin to avoid inheriting old local commits
      await execAsync(`git fetch origin ${repoDefaultBranch}`, { cwd: repoDir })
      await execAsync(`git checkout ${repoDefaultBranch}`, { cwd: repoDir })
      await execAsync(`git reset --hard origin/${repoDefaultBranch}`, { cwd: repoDir })
    }
    await execAsync(`git checkout -b ${branch} 2>/dev/null || git checkout ${branch}`, { cwd: repoDir })
    if (hasUncommitted) {
      await execAsync('git add -A', { cwd: repoDir })
      await execAsync(`git commit -m "${prTitle.replace(/"/g, '\\"')}"`, { cwd: repoDir })
    }
    // Inject auth token into remote URL so push works non-interactively
    const authUrl = injectTokenIntoRemoteUrl(repoUrl, repoPlatform, repoToken)
    if (authUrl !== repoUrl) {
      try {
        await execAsync(`git remote set-url origin ${authUrl}`, { cwd: repoDir })
      } catch {}
    }

    // Try normal push first — only force-push on explicit failure
    try {
      await execAsync(`git push -u origin ${branch}`, { cwd: repoDir })
    } catch (pushErr: any) {
      console.warn(`[pr.post] Push rejected for ${branch}: ${pushErr.message}. Force pushing...`)
      await execAsync(`git push --force -u origin ${branch}`, { cwd: repoDir })
    }

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
        // Extract hostname only (drop scheme, auth, port) — glab expects just the host
        const hostMatch = remoteUrl.trim().match(/^https?:\/\/(?:[^@]+@)?([^\/]+)/)
        if (hostMatch) {
          gitlabHost = hostMatch[1]
        }
      } catch {}
    }

    const gitlabEnv: NodeJS.ProcessEnv = gitlabHost
      ? { ...process.env, GITLAB_HOST: gitlabHost, ...(repoToken ? { GITLAB_TOKEN: repoToken } : {}) }
      : process.env

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
