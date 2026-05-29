import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { getDiffSummary } from '~/server/utils/git-summary'
import { toHumanReadableTitle } from '~/server/utils/conventional-commit'
import { parseGithubUrl, fetchPullRequestDetails, fetchPullRequestReviews, determineReviewState } from '~/server/utils/github-api'
import { injectTokenIntoRemoteUrl } from '~/server/utils/git-helpers'
import { resolveCloneDir, resolveWorktreeDir, projectsDir } from '~/server/utils/worktree-resolver'

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

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)

  const db = getDb()
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    columns: { id: true, title: true, description: true, projectId: true, repositoryId: true, branchName: true },
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

  const mainCloneDir = resolveCloneDir(repoUrl, repoName, projectsDir)
  const repoDir = resolveWorktreeDir(mainCloneDir, id)

  const branch = task.branchName || sanitizeBranchName(task.title)

  let prBody = ''
  let prTitle = toHumanReadableTitle(branch)
  let hasUncommitted = false
  let hasCommittedChanges = false

  // ── Determine if we have a local worktree with changes ──
  const hasWorktree = existsSync(repoDir)
  let prCwd = repoDir

  if (hasWorktree) {
    prBody = await getDiffSummary(repoDir, repoDefaultBranch, prTitle, task.description)

    const { stdout: status } = await execAsync('git status --porcelain', { cwd: repoDir })
    hasUncommitted = !!status.trim()

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

    // Build PR title & body from agent commits (preferred) or diff (fallback)
    try {
      // Try to read the actual commit messages the agent created
      const { stdout: commitLog } = await execAsync(
        `git log origin/${repoDefaultBranch}..HEAD --format="%s" --no-merges`,
        { cwd: repoDir }
      )
      const commits = commitLog.trim().split('\n').filter(Boolean)
      if (commits.length > 0) {
        // Keep branch-based PR title, list all commits as body bullets
        prBody = await getDiffSummary(repoDir, repoDefaultBranch, prTitle, task.description)
        prBody += '\n\n## Commits\n\n'
        for (const c of commits) {
          prBody += `- ${c}\n`
        }
      } else {
        // No commits yet (uncommitted changes) — summarize diff for PR body
        prBody = await getDiffSummary(repoDir, repoDefaultBranch, prTitle, task.description)
      }
    } catch {
      // Fallback to task title + diff summary
      prBody = await getDiffSummary(repoDir, repoDefaultBranch, prTitle, task.description)
    }
  } else {
    // No local worktree — check if the branch exists on remote
    let branchExistsOnRemote = false
    try {
      await execAsync(`git fetch origin ${branch} 2>/dev/null`, { cwd: mainCloneDir })
      const { stdout } = await execAsync(
        `git ls-remote --heads origin ${branch} 2>/dev/null || true`,
        { cwd: mainCloneDir }
      )
      branchExistsOnRemote = !!stdout.trim()
    } catch {}

    if (!branchExistsOnRemote) {
      throw createError({ statusCode: 400, statusMessage: 'Task worktree not found. Run the agent first.' })
    }

    // Branch exists on remote — we can create PR from main clone dir
    prCwd = mainCloneDir
    hasCommittedChanges = true

    // Build PR title & body from remote branch commits
    try {
      const { stdout: commitLog } = await execAsync(
        `git log origin/${repoDefaultBranch}..origin/${branch} --format="%s" --no-merges`,
        { cwd: mainCloneDir }
      )
      const commits = commitLog.trim().split('\n').filter(Boolean)
      if (commits.length > 0) {
        prBody = `## Summary\n\n**${prTitle}**\n\n`
        if (task.description) {
          prBody += `${task.description}\n\n`
        }
        prBody += `## Commits\n\n`
        for (const c of commits) {
          prBody += `- ${c}\n`
        }
      }
    } catch {
      // Fallback to task title
    }
  }

  try {
    // ── Commit & push only if we have a local worktree with changes ──
    if (hasWorktree && (hasUncommitted || hasCommittedChanges)) {
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
    }

    let cli = 'gh'
    let gitlabHost = ''
    try {
      const { stdout: remotes } = await execAsync('git remote -v', { cwd: prCwd })
      if (remotes.includes('gitlab')) {
        cli = 'glab'
      }
    } catch {}

    if (cli === 'gh') {
      try {
        await execAsync('gh repo view >/dev/null 2>&1', { cwd: prCwd })
      } catch {
        try {
          await execAsync('glab repo view >/dev/null 2>&1', { cwd: prCwd })
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
        const { stdout: remoteUrl } = await execAsync('git remote get-url origin', { cwd: prCwd })
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

    const githubEnv: NodeJS.ProcessEnv = repoToken && cli === 'gh'
      ? { ...process.env, GITHUB_TOKEN: repoToken }
      : { ...process.env }

    // Check if PR/MR already exists for this branch
    let existingPrUrl = ''
    try {
      if (cli === 'glab') {
        const { stdout: existing } = await execAsync(
          `glab mr view ${branch} -F json 2>/dev/null | jq -r '.web_url // empty' || true`,
          { cwd: prCwd, env: gitlabEnv }
        )
        existingPrUrl = existing.trim()
        if (existingPrUrl === 'null' || !existingPrUrl) existingPrUrl = ''
      } else {
        const { stdout: existing } = await execAsync(
          `gh pr view ${branch} --json url --jq '.url // empty' 2>/dev/null || true`,
          { cwd: prCwd, env: githubEnv }
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
            await execAsync(`glab mr update ${branch} --description ${shEscape(bodyContent)}`, { cwd: prCwd, env: gitlabEnv })
          } else {
            await execAsync(`gh pr edit ${branch} --body-file /tmp/pr-body.md`, { cwd: prCwd, env: githubEnv })
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

      // Upsert into pull_requests table for existing PRs too
      try {
        const parsed = parseGithubUrl(existingPrUrl)
        if (parsed) {
          const details = await fetchPullRequestDetails(
            parsed.owner, parsed.repo, parsed.number,
            parsed.host, parsed.isEnterprise, repoToken
          )
          const reviews = await fetchPullRequestReviews(
            parsed.owner, parsed.repo, parsed.number,
            parsed.host, parsed.isEnterprise, repoToken
          )
          const reviewState = determineReviewState(reviews)

          const existingPr = await db.query.pullRequests.findFirst({
            where: eq(schema.pullRequests.taskId, id),
          })

          if (existingPr) {
            await db.update(schema.pullRequests)
              .set({
                githubNumber: details.githubNumber,
                title: details.title,
                url: existingPrUrl,
                status: details.status,
                draft: details.draft,
                reviewState,
                mergeableState: details.mergeableState,
                conflictStatus: existingPr.conflictStatus === 'none' ? 'none' : existingPr.conflictStatus,
                headBranch: details.headBranch || branch,
                baseBranch: details.baseBranch || repoDefaultBranch,
                agentFixStatus: existingPr.agentFixStatus === 'in_progress' ? 'done' : existingPr.agentFixStatus,
                lastSyncedAt: new Date(),
              })
              .where(eq(schema.pullRequests.id, existingPr.id))
          } else {
            await db.insert(schema.pullRequests).values({
              taskId: id,
              repositoryId: task.repositoryId || null,
              githubNumber: details.githubNumber,
              title: details.title,
              url: existingPrUrl,
              status: details.status,
              draft: details.draft,
              reviewState,
              mergeableState: details.mergeableState,
              conflictStatus: 'none',
              headBranch: details.headBranch || branch,
              baseBranch: details.baseBranch || repoDefaultBranch,
            })
          }
        }
      } catch (syncErr: any) {
        console.error('[pr.post] Failed to sync existing pull_requests table:', syncErr.message)
      }

      return { url: existingPrUrl, branch }
    }

    // Always write body file (even if empty) so CLI always has a body source
    writeFileSync('/tmp/pr-body.md', prBody || '', 'utf-8')

    // Convert PR title to human-readable format (strip conventional commit prefixes, task- prefix, etc.)
    prTitle = toHumanReadableTitle(prTitle)

    let prUrl = ''
    let lastError = ''
    const safeTitle = (prTitle || 'Task update').trim()
    if (cli === 'glab') {
      const bodyArg = prBody ? `--description ${shEscape(readFileSync('/tmp/pr-body.md', 'utf-8'))}` : `--description "${''}"`
      const titleArg = `--title ${shEscape(safeTitle)}`
      const cmd = `glab mr create ${titleArg} ${bodyArg} --target-branch ${repoDefaultBranch || 'main'} --source-branch ${branch} -y 2>&1 || true`
      console.log(`[pr.post] Running glab command: ${cmd}`)
      const { stdout, stderr } = await execAsync(
        cmd,
        { cwd: prCwd, env: gitlabEnv }
      )
      const output = (stdout + stderr).trim()
      console.log(`[pr.post] glab output: ${output.slice(0, 500)}`)
      const urlMatch = output.match(/https?:\/\/[^\s]+/)
      prUrl = urlMatch ? urlMatch[0] : ''
      if (!prUrl) lastError = output.slice(0, 600)

      if (!prUrl) {
        console.log(`[pr.post] glab create failed, trying fallback mr view for branch ${branch}`)
        const { stdout: fallback } = await execAsync(
          `glab mr view ${branch} -F json 2>/dev/null | jq -r '.web_url // empty' || true`,
          { cwd: prCwd, env: gitlabEnv }
        )
        prUrl = fallback.trim()
        if (prUrl === 'null' || prUrl === '') {
          prUrl = ''
          if (!lastError) lastError = (output || fallback).slice(0, 600)
        }
      }
    } else {
      const { stdout, stderr } = await execAsync(
        `gh pr create --title "${prTitle.replace(/"/g, '\\"')}" --body-file /tmp/pr-body.md --base ${repoDefaultBranch || 'main'} --head ${branch}`,
        { cwd: prCwd, env: githubEnv }
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

    // Upsert into pull_requests table
    try {
      const parsed = parseGithubUrl(prUrl)
      if (parsed) {
        const details = await fetchPullRequestDetails(
          parsed.owner, parsed.repo, parsed.number,
          parsed.host, parsed.isEnterprise, repoToken
        )
        const reviews = await fetchPullRequestReviews(
          parsed.owner, parsed.repo, parsed.number,
          parsed.host, parsed.isEnterprise, repoToken
        )
        const reviewState = determineReviewState(reviews)

        const existingPr = await db.query.pullRequests.findFirst({
          where: eq(schema.pullRequests.taskId, id),
        })

        if (existingPr) {
          await db.update(schema.pullRequests)
            .set({
              githubNumber: details.githubNumber,
              title: details.title,
              url: prUrl,
              status: details.status,
              draft: details.draft,
              reviewState,
              mergeableState: details.mergeableState,
              conflictStatus: existingPr.conflictStatus === 'none' ? 'none' : existingPr.conflictStatus,
              headBranch: details.headBranch || branch,
              baseBranch: details.baseBranch || repoDefaultBranch,
              agentFixStatus: existingPr.agentFixStatus === 'in_progress' ? 'done' : existingPr.agentFixStatus,
              lastSyncedAt: new Date(),
            })
            .where(eq(schema.pullRequests.id, existingPr.id))
        } else {
          await db.insert(schema.pullRequests).values({
            taskId: id,
            repositoryId: task.repositoryId || null,
            githubNumber: details.githubNumber,
            title: details.title,
            url: prUrl,
            status: details.status,
            draft: details.draft,
            reviewState,
            mergeableState: details.mergeableState,
            conflictStatus: 'none',
            headBranch: details.headBranch || branch,
            baseBranch: details.baseBranch || repoDefaultBranch,
          })
        }
      }
    } catch (syncErr: any) {
      console.error('[pr.post] Failed to sync pull_requests table:', syncErr.message)
    }

    return { url: prUrl, branch }
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: `PR creation failed: ${err.message}` })
  }
})
