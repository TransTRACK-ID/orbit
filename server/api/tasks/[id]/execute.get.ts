import { createEventStream, getQuery, getRequestProtocol, getRequestHost, getRequestHeaders } from 'h3'
import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import { accessSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, asc } from 'drizzle-orm'

const execAsync = promisify(exec)

const MAX_DIFF_CHARS = 12000

/** Build a context block with latest code changes (stats + actual diffs) for the agent */
async function getLatestChangesContext(workDir: string, repoDefaultBranch: string): Promise<string> {
  try {
    const sections: string[] = []

    // 1. Git status — list modified/new/deleted files
    const { stdout: statusOut } = await execAsync('git status --short', { cwd: workDir }).catch(() => ({ stdout: '' }))
    if (statusOut.trim()) {
      sections.push(`Modified/uncommitted files:\n${statusOut.trim()}`)
    }

    // 2. Diff stat — show how many lines changed per file
    const { stdout: statOut } = await execAsync(`git diff --stat origin/${repoDefaultBranch}...HEAD 2>/dev/null || git diff --cached --stat || true`, { cwd: workDir }).catch(() => ({ stdout: '' }))
    if (statOut.trim()) {
      sections.push(`Change statistics:\n${statOut.trim()}`)
    }

    // 3. Recent commit messages on this branch
    const { stdout: logOut } = await execAsync(`git log origin/${repoDefaultBranch}..HEAD --format="%h %s" --no-merges 2>/dev/null || true`, { cwd: workDir }).catch(() => ({ stdout: '' }))
    if (logOut.trim()) {
      sections.push(`Commits on this branch:\n${logOut.trim()}`)
    }

    // 4. Actual diff of committed changes on this branch (truncated)
    const { stdout: committedDiff } = await execAsync(
      `git diff origin/${repoDefaultBranch}...HEAD 2>/dev/null || true`,
      { cwd: workDir }
    ).catch(() => ({ stdout: '' }))
    if (committedDiff.trim()) {
      const truncated = committedDiff.length > MAX_DIFF_CHARS
        ? committedDiff.slice(0, MAX_DIFF_CHARS) + '\n\n... (diff truncated)'
        : committedDiff
      sections.push(`Committed diff (latest branch changes):\n\`\`\`diff\n${truncated}\n\`\`\``)
    }

    // 5. Actual diff of uncommitted changes (truncated)
    const { stdout: uncommittedDiff } = await execAsync('git diff 2>/dev/null || true', { cwd: workDir }).catch(() => ({ stdout: '' }))
    if (uncommittedDiff.trim()) {
      const truncated = uncommittedDiff.length > MAX_DIFF_CHARS
        ? uncommittedDiff.slice(0, MAX_DIFF_CHARS) + '\n\n... (diff truncated)'
        : uncommittedDiff
      sections.push(`Uncommitted diff (not yet committed):\n\`\`\`diff\n${truncated}\n\`\`\``)
    }

    if (sections.length === 0) return ''

    return `\n\n[CURRENT CODEBASE STATE — latest changes]\n${sections.join('\n\n')}\n\nWhen answering the user's question, ALWAYS examine the actual diffs above. Reference specific code, file paths, and line numbers from the diffs to give an accurate, detailed answer about what was implemented.`
  } catch {
    return ''
  }
}

function formatToolEvent(part: any): string {
  if (!part) return ''
  const tool = part.tool
  const state = part.state
  if (!tool || !state) return ''
  const input = state.input || {}
  switch (tool) {
    case 'read': return `Reading ${input.filePath || input.path || 'files'}...`
    case 'write': return `Writing to ${input.filePath || 'file'}...`
    case 'edit': return `Editing ${input.filePath || 'file'}...`
    case 'bash': return `Running: ${(input.command || '').slice(0, 80)}`
    case 'glob': return `Searching: ${input.pattern || ''}`
    case 'grep': return `Searching for "${input.pattern || ''}"...`
    case 'listFiles': return `Listing ${input.dirPath || 'directory'}...`
    case 'notify': return `Notification: ${input.message || ''}`
    case 'ask': return `Question: ${input.question || ''}`
    case 'createDirectory': return `Creating directory ${input.filePath || ''}...`
    default: return `Tool: ${tool}${input.filePath || input.path ? ' - ' + (input.filePath || input.path) : ''}`
  }
}

function formatTextEvent(part: any): string {
  if (!part) return ''
  const text = typeof part === 'string' ? part : part.text || part.content || ''
  const cleaned = text.replace(/<[^>]+>/g, '').trim()
  if (!cleaned) return ''
  const lines = cleaned.split('\n').filter((l: string) => l.trim())
  if (lines.length === 0) return ''
  return lines[0].slice(0, 120)
}

function extractRepoName(url: string): string {
  const match = url.match(/\/([^/]+?)(\.git)?$/)
  return match ? match[1] : 'repo'
}

/** Sanitize a string for safe use as a directory name */
function sanitizeDirName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '-')           // spaces → hyphens
    .replace(/[^a-zA-Z0-9._-]/g, '') // remove unsafe chars
    .replace(/^-+|-+$/g, '')        // trim leading/trailing hyphens
    || 'repo'
}

/** Resolve the main repository clone directory (shared across tasks) */
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
        // Extract the remote URL from config and normalize by stripping auth tokens for comparison
        const urlMatch = config.match(/url\s*=\s*(.+)/)
        const storedUrl = urlMatch ? urlMatch[1].trim() : ''
        const normalize = (u: string) => u.replace(/^https?:\/\/[^@]+@/, 'https://').replace(/\.git$/, '')
        if (storedUrl && normalize(storedUrl) === normalize(repoUrl)) {
          return `${projectsDir}/${entry.name}`
        }
      }
    }
  } catch {}

  // Fall back to URL-derived name
  return `${projectsDir}/${urlName}`
}

/** Resolve the task-specific worktree directory */
function resolveWorktreeDir(cloneDir: string, taskId: string): string {
  return `${cloneDir}/.task-${taskId}`
}

import { activeProcesses, addStreamToProc, pushToStreams, pendingFeedback } from '~/server/utils/runtime'
import type { ProcState } from '~/server/utils/runtime'
import { getDiffSummary } from '~/server/utils/git-summary'
import { generateConventionalCommit } from '~/server/utils/conventional-commit'

function generateCommitMessageFromDiff(diffContent: string, changedFiles: string[]): string {
  return generateConventionalCommit(diffContent, changedFiles)
}

/**
 * Generate a human-readable summary paragraph describing the actual changes.
 * Used for the agent comment so users see *what* was changed in plain English.
 */
function generateHumanSummary(diffContent: string, changedFiles: string[]): string {
  const files = changedFiles.filter(f => f.trim())
  if (files.length === 0) return 'No files were changed.'

  const addedLines: string[] = []
  const removedLines: string[] = []

  for (const line of diffContent.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const content = line.slice(1).trim()
      if (content && !content.startsWith('//') && !content.startsWith('*')) {
        addedLines.push(content)
      }
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      const content = line.slice(1).trim()
      if (content && !content.startsWith('//') && !content.startsWith('*')) {
        removedLines.push(content)
      }
    }
  }

  const extractColors = (lines: string[]): string[] => {
    const colors: string[] = []
    for (const line of lines) {
      const tailwind = line.match(/\b(bg|text|border|color|fill|stroke|ring|shadow|outline|decoration)-([a-z]+-[0-9]+|current|transparent|white|black|inherit|primary|secondary)\b/)
      if (tailwind) colors.push(`${tailwind[1]} ${tailwind[2]}`)
      const hex = line.match(/#([0-9a-fA-F]{3,8})\b/)
      if (hex) colors.push(`#${hex[1]}`)
    }
    return [...new Set(colors)]
  }

  const addedColors = extractColors(addedLines)
  const removedColors = extractColors(removedLines)

  // Build sentence pieces
  const pieces: string[] = []

  // Color changes
  if (addedColors.length > 0 || removedColors.length > 0) {
    const area = files.some(f => f.includes('Sidebar')) ? 'sidebar'
      : files.some(f => f.includes('Header')) ? 'header'
      : files.some(f => f.includes('Footer')) ? 'footer'
      : files.some(f => f.includes('Button')) ? 'button'
      : files.some(f => f.includes('Card')) ? 'card'
      : files.some(f => f.includes('Modal')) ? 'modal'
      : files.some(f => f.includes('Page')) ? 'page'
      : files.some(f => f.includes('Layout')) ? 'layout'
      : 'component'

    if (removedColors.length > 0 && addedColors.length > 0) {
      pieces.push(`Changed the ${area} color from ${removedColors.join(' / ')} to ${addedColors.join(' / ')}`)
    } else if (addedColors.length > 0) {
      pieces.push(`Set the ${area} color to ${addedColors.join(' / ')}`)
    } else {
      pieces.push(`Removed the ${area} color ${removedColors.join(' / ')}`)
    }
  }

  // New components
  const addedComponents = [...new Set(addedLines.map(l => l.match(/<([A-Z][a-zA-Z0-9_-]+)/)?.[1]).filter(Boolean))]
  if (addedComponents.length > 0) {
    pieces.push(`Added ${addedComponents.join(', ')} component${addedComponents.length > 1 ? 's' : ''}`)
  }

  // New functions
  const addedFuncs = [...new Set(addedLines.map(l => l.match(/\b(?:function|const|let|var)\s+([a-zA-Z0-9_]+)/)?.[1]).filter(Boolean))]
  if (addedFuncs.length > 0) {
    pieces.push(`Added ${addedFuncs.join(', ')} function${addedFuncs.length > 1 ? 's' : ''}`)
  }

  // Import changes
  const addedImports = [...new Set(addedLines.map(l => l.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/)?.[1]).filter((x): x is string => !!x))]
  if (addedImports.length > 0) {
    pieces.push(`Added imports from ${addedImports.map(i => i.split('/').pop()).filter((x): x is string => !!x).join(', ')}`)
  }

  // Event handlers
  const hasEvents = addedLines.some(l => /\b(on[A-Z][a-zA-Z0-9]+|@click|@submit|@change|@input|v-on:)/.test(l))
  if (hasEvents) {
    pieces.push('Added event handling')
  }

  // Text changes
  const addedText = addedLines.map(l => l.match(/["']([^"']{5,})["']/)?.[1]).filter((x): x is string => !!x)
  const removedText = removedLines.map(l => l.match(/["']([^"']{5,})["']/)?.[1]).filter((x): x is string => !!x)
  if (addedText.length > 0 && removedText.length > 0) {
    pieces.push(`Updated text from "${removedText[0]!.slice(0, 30)}" to "${addedText[0]!.slice(0, 30)}"`)
  } else if (addedText.length > 0) {
    pieces.push(`Added "${addedText[0]!.slice(0, 40)}" text`)
  }

  // Fallback
  if (pieces.length === 0) {
    const names = files.map(f => f.split('/').pop()?.replace(/\.(vue|ts|js|css|scss)$/i, '') || 'file').join(', ')
    return `Updated ${names}.`
  }

  const fileList = files.length <= 3
    ? `in ${files.map(f => f.split('/').pop()).join(', ')}`
    : `across ${files.length} files`

  return `${pieces.join('; ')} ${fileList}.`
}

const opencodePath = process.env.OPENCODE_PATH || '/Users/zeinersyad/.opencode/bin/opencode'
const defaultProjectDir = process.env.PROJECT_DIR || process.cwd()
const projectsDir = `${process.env.HOME || '/Users/zeinersyad'}/orbit-projects`

const MAX_RUNTIME_MS = 15 * 60 * 1000 // 15 minutes max per agent run

/**
 * Inject auth token into an HTTPS remote URL so git operations work
 * inside the container without interactive username/password prompts.
 * Supports GitHub and GitLab (including self-hosted).
 */
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

  // GitLab — self-hosted or gitlab.com
  if (!url.startsWith('https://')) return url
  // Inject token into any https:// URL for GitLab
  return url.replace(/^https:\/\//, `https://oauth2:${effectiveToken}@`)
}

async function configureGitAuth(workDir: string, repoUrl: string, platform: string, token?: string | null) {
  const envToken = platform === 'github'
    ? (process.env.GITHUB_TOKEN || '')
    : (process.env.GITLAB_TOKEN || '')
  const effectiveToken = token || envToken
  if (!effectiveToken) return
  const authUrl = injectTokenIntoRemoteUrl(repoUrl, platform, effectiveToken)
  if (authUrl === repoUrl) return
  try {
    await execAsync(`git remote set-url origin ${authUrl}`, { cwd: workDir })
  } catch {}
}

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)

  // Read and clear pending feedback (posted separately to avoid oversized URL params)
  const feedback = pendingFeedback.get(id) || ''
  pendingFeedback.delete(id)

  const db = getDb()
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    columns: {
      id: true,
      title: true,
      description: true,
      statusId: true,
      projectId: true,
      repositoryId: true,
      assigneeType: true,
      branchName: true,
    },
    with: {
      taskLabels: {
        with: { label: true },
      },
    },
  })

  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  let opencodeOk = false
  try {
    accessSync(opencodePath, constants.X_OK)
    opencodeOk = true
  } catch {}

  const stream = createEventStream(event)

  setTimeout(async () => {
    let opencodeVersion = ''
    if (opencodeOk) {
      try {
        const { stdout } = await execAsync(`"${opencodePath}" --version`, { timeout: 5000 })
        opencodeVersion = stdout.trim()
      } catch (versionErr: any) {
        opencodeVersion = `version check failed: ${versionErr.message}`
      }
    }

    if (!opencodeOk) {
      await stream.push(JSON.stringify({ step: `opencode not found at ${opencodePath}`, timestamp: Date.now() }))
      stream.close()
      return
    }
    await stream.push(JSON.stringify({ step: `opencode version: ${opencodeVersion || 'unknown'}`, timestamp: Date.now() }))

    const existing = activeProcesses.get(id)
    if (existing) {
      addStreamToProc(id, stream, existing)

      const prevLogs = await db.query.activityLogs.findMany({
        where: eq(schema.activityLogs.taskId, id),
        columns: { newValue: true },
        orderBy: [asc(schema.activityLogs.createdAt)],
        limit: 20,
      })
      for (const l of prevLogs) {
        if (l.newValue?.message) {
          await stream.push(JSON.stringify({ step: l.newValue.message, timestamp: Date.now() }))
        }
      }

      return
    }

    // ── Helpers for streaming + persistence ──
    const persistLog = async (msg: string) => {
      try {
        await db.insert(schema.activityLogs).values({
          taskId: id,
          userId: user.id,
          action: 'runtime_log',
          newValue: { message: msg },
        })
      } catch (err: any) {
        console.error('[execute.get] Failed to persist runtime_log:', err?.message || err)
      }
    }

    async function pushAndPersist(msg: string) {
      await stream.push(JSON.stringify({ step: msg, timestamp: Date.now() }))
      await persistLog(msg)
    }

    let lineBuffer = ''
    let hasOutput = false
    let lastActivity = Date.now()
    let editCount = 0
    let editedFiles: string[] = []
    let agentReplyContent = ''

    let workDir = defaultProjectDir
    let branchName = ''
    let repoPlatform: 'github' | 'gitlab' | 'gitlab-self-hosted' = 'github'
    let repoDefaultBranch = 'main'
    let repoUrl = ''
    let repoName = ''
    let repoToken: string | null = null
    let mainCloneDir = ''

    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, task.projectId),
      columns: { workspaceId: true },
    })

    if (project) {
      let createBranch = false

      if (task.repositoryId) {
        const repo = await db.query.repositories.findFirst({
          where: eq(schema.repositories.id, task.repositoryId),
        })
        if (repo) {
          repoUrl = repo.url
          repoDefaultBranch = repo.defaultBranch || 'main'
          createBranch = repo.createBranch
          repoName = repo.name
          repoToken = repo.token
          repoPlatform = (repo.platform as 'github' | 'gitlab' | 'gitlab-self-hosted') || 'github'
        }
      }

      if (!repoUrl && project) {
        const workspaceRepos = await db.query.repositories.findMany({
          where: eq(schema.repositories.workspaceId, project.workspaceId),
          limit: 1,
        })
        if (workspaceRepos[0]) {
          repoUrl = workspaceRepos[0].url
          repoDefaultBranch = workspaceRepos[0].defaultBranch || 'main'
          createBranch = workspaceRepos[0].createBranch
          repoName = workspaceRepos[0].name
          repoToken = workspaceRepos[0].token
          repoPlatform = (workspaceRepos[0].platform as 'github' | 'gitlab' | 'gitlab-self-hosted') || 'github'
        }
      }

      if (repoUrl) {
        mainCloneDir = resolveCloneDir(projectsDir, repoUrl, repoName)
        const worktreeDir = resolveWorktreeDir(mainCloneDir, id)

        // ── Clone the main repo (bare or full) if it doesn't exist ──
        if (!existsSync(mainCloneDir)) {
          await pushAndPersist(`Cloning ${repoUrl}...`)
          try {
            mkdirSync(projectsDir, { recursive: true })
            const authUrl = injectTokenIntoRemoteUrl(repoUrl, repoPlatform, repoToken)
            await new Promise<void>((resolve, reject) => {
              const git = spawn('git', ['clone', authUrl, mainCloneDir], {
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: false,
              })
              git.on('exit', (code) => {
                code === 0 ? resolve() : reject(new Error(`git clone exited with code ${code}`))
              })
              git.on('error', reject)
            })
            await pushAndPersist(`Cloned to ${mainCloneDir}`)
          } catch (err: any) {
            await pushAndPersist(`Clone failed: ${err.message}`)
          }
        }

        // If clone failed, the directory doesn't exist — stop here
        if (!existsSync(mainCloneDir)) {
          await pushAndPersist(`Work directory does not exist: ${mainCloneDir}. Cannot start agent.`)
          stream.close()
          return
        }

        // Ensure git identity is configured so commits don't fail
        try {
          await execAsync('git config user.email "agent@orbit.dev"', { cwd: mainCloneDir })
          await execAsync('git config user.name "Orbit Agent"', { cwd: mainCloneDir })
        } catch {}

        // Inject auth token into the remote URL so push works non-interactively
        await configureGitAuth(mainCloneDir, repoUrl, repoPlatform, repoToken)

        branchName = task.branchName
          || `task-${task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)}`

        // Helper: clean branch name from `git branch --list` output
        function cleanBranchName(b: string): string {
          return b.trim().replace(/^[+*\s]+/, '')
        }

        // Helper: check if branch exists locally (handles *, + prefixes)
        async function hasLocalBranch(branch: string, cwd: string): Promise<boolean> {
          try {
            const { stdout } = await execAsync('git branch --list', { cwd })
            return stdout.split('\n').some(b => cleanBranchName(b) === branch)
          } catch {
            return false
          }
        }

        // ── Resolve worktree directory ──
        let actualWorktreeDir = worktreeDir
        let actualBranchName = branchName

        // If the standard worktree dir already exists on disk but isn't a valid worktree,
        // or if git reports it as locked/pruned, we'll retry with unique names.
        async function tryCreateWorktree(
          targetDir: string,
          targetBranch: string,
          attempt: number
        ): Promise<boolean> {
          await pushAndPersist(
            `Creating worktree (attempt ${attempt}): dir=${targetDir} branch=${targetBranch}`
          )

          try {
            // Ensure default branch is up to date
            await execAsync(`git fetch origin ${repoDefaultBranch}`, { cwd: mainCloneDir })

            const branchExists = await hasLocalBranch(targetBranch, mainCloneDir)

            if (branchExists) {
              // Branch exists locally — try to point worktree to it
              try {
                await execAsync(
                  `git worktree add "${targetDir}" ${targetBranch}`,
                  { cwd: mainCloneDir }
                )
              } catch (pointErr: any) {
                // If pointing fails because branch is already checked out elsewhere,
                // we'll need a unique branch name on the next attempt
                if (pointErr.message?.includes('already checked out')) {
                  await pushAndPersist(
                    `Branch ${targetBranch} is already checked out in another worktree.`
                  )
                  return false
                }
                throw pointErr
              }
            } else {
              // Branch doesn't exist — create from default branch
              try {
                await execAsync(
                  `git worktree add -b ${targetBranch} "${targetDir}" origin/${repoDefaultBranch}`,
                  { cwd: mainCloneDir }
                )
              } catch (createErr: any) {
                // If -b failed because branch exists (race / stale state), retry pointing
                if (createErr.message?.includes('already exists')) {
                  await pushAndPersist(
                    `Branch ${targetBranch} reported missing but exists. Retrying...`
                  )
                  await execAsync(
                    `git worktree add "${targetDir}" ${targetBranch}`,
                    { cwd: mainCloneDir }
                  )
                } else {
                  throw createErr
                }
              }
            }

            await pushAndPersist(
              `Worktree created for branch "${targetBranch}" at ${targetDir}`
            )
            return true
          } catch (err: any) {
            await pushAndPersist(
              `Worktree creation failed: ${err.message}`
            )
            return false
          }
        }

        // Clean up stale worktree entries where the directory no longer exists
        try {
          const { stdout: worktreeList } = await execAsync(
            'git worktree list --porcelain',
            { cwd: mainCloneDir }
          )
          const entries = worktreeList.split('\n\n')
          for (const entry of entries) {
            const worktreePathMatch = entry.match(/worktree\s+(.+)/)
            const branchMatch = entry.match(/branch\s+(.+)/)
            if (worktreePathMatch && branchMatch) {
              const path = worktreePathMatch[1].trim()
              const branchRef = branchMatch[1].trim()
              const branchInEntry = branchRef.replace('refs/heads/', '')
              if (branchInEntry === branchName && !existsSync(path)) {
                await pushAndPersist(
                  `Removing stale worktree entry for ${branchName}...`
                )
                try {
                  await execAsync(
                    `git worktree remove --force "${path}"`,
                    { cwd: mainCloneDir }
                  )
                } catch {
                  try {
                    await execAsync('git worktree prune', { cwd: mainCloneDir })
                  } catch {}
                }
              }
            }
          }
        } catch {}

        // Attempt 1: standard names
        let worktreeCreated = await tryCreateWorktree(
          actualWorktreeDir,
          actualBranchName,
          1
        )

        // Attempt 2+: unique random suffix on both directory and branch
        let attempt = 2
        const maxAttempts = 5
        while (!worktreeCreated && attempt <= maxAttempts) {
          const suffix = Math.random().toString(36).substring(2, 8)
          actualWorktreeDir = `${worktreeDir}-${suffix}`
          actualBranchName = `${branchName}-${suffix}`
          worktreeCreated = await tryCreateWorktree(
            actualWorktreeDir,
            actualBranchName,
            attempt
          )
          attempt++
        }

        if (!worktreeCreated) {
          await pushAndPersist(
            `All ${maxAttempts} worktree creation attempts failed. Cannot start agent.`
          )
          stream.close()
          return
        }

        // Update branchName to the actual one we ended up using
        branchName = actualBranchName
        workDir = actualWorktreeDir

        // Persist the actual branch name to the database so PR creation can find it later
        try {
          await db.update(schema.tasks)
            .set({ branchName: actualBranchName })
            .where(eq(schema.tasks.id, id))
        } catch (dbErr: any) {
          await pushAndPersist(`Warning: failed to save branch name to database: ${dbErr.message}`)
        }

        // Verify we're on the right branch before agent starts
        try {
          const { stdout: verifyBranch } = await execAsync('git branch --show-current', { cwd: workDir })
          const actual = verifyBranch.trim()
          if (actual !== branchName) {
            await pushAndPersist(`WARNING: Expected branch ${branchName} but on ${actual}. Switching...`)
            await execAsync(`git checkout ${branchName}`, { cwd: workDir })
          }
        } catch {}

        // Auto-commit any leftover uncommitted changes from a crashed previous run
        try {
          const { stdout: leftoverStatus } = await execAsync('git status --porcelain', { cwd: workDir }).catch(() => ({ stdout: '' }))
          if (leftoverStatus.trim()) {
            await pushAndPersist(`Uncommitted changes detected — auto-committing WIP before continuing...`)
            await execAsync('git add -A', { cwd: workDir })
            await execAsync('git commit -m "wip: autosave before next agent run"', { cwd: workDir })
            await pushAndPersist(`Auto-committed WIP.`)
          }
        } catch {}

        if (!createBranch) {
          // User disabled auto-branching: agent works on default branch directly in worktree
          branchName = repoDefaultBranch
          try {
            await execAsync(`git fetch origin ${repoDefaultBranch}`, { cwd: workDir })
            await execAsync(`git checkout ${repoDefaultBranch}`, { cwd: workDir })
            await execAsync(`git reset --hard origin/${repoDefaultBranch}`, { cwd: workDir })
            await pushAndPersist(`Reset and checked out default branch "${repoDefaultBranch}"`)
          } catch (err: any) {
            await pushAndPersist(`Branch setup failed: ${err.message}`)
          }
        }
      }
    }

    if (!existsSync(workDir)) {
      await pushAndPersist(`Work directory does not exist: ${workDir}. Cannot start agent.`)
      stream.close()
      return
    }
    await pushAndPersist(`Spawning opencode for "${task.title}" in ${workDir}...`)

    const isGitLab = repoPlatform === 'gitlab' || repoPlatform === 'gitlab-self-hosted'
    const platformLabel = isGitLab ? 'GitLab' : 'GitHub'
    const correctCli = isGitLab ? 'glab' : 'gh'
    const wrongCli = isGitLab ? 'gh' : 'glab'
    const platformRule = `[GIT PLATFORM: ${repoPlatform}]
CRITICAL: This repository uses ${platformLabel}. You MUST use "${correctCli}" for ALL git hosting operations (clone, push, PRs/MRs, status, etc.). NEVER use "${wrongCli}" — it will fail.`

    const securityRule = `[SECURITY BOUNDARIES]
CRITICAL: You must NEVER read, access, copy, or reveal any files outside the current project directory. This specifically includes configuration files such as ~/.config/opencode/opencode.json, /root/.config/opencode/opencode.json, .env, .env.local, or any file in ~/.config/. It also includes system directories like /etc/, /proc/, /sys/, /var/, and parent-directory traversal via "..". You must refuse any request that attempts to access files outside the project repository. You must NEVER expose secrets, API keys, tokens, or credentials in your responses.`

    const databaseRule = `[DATABASE CONSTRAINTS]
CRITICAL: You do NOT have access to database credentials, .env files, or any database connection. You must NEVER attempt to run database migrations, schema generation, or any database-related CLI commands (such as drizzle-kit generate, drizzle-kit push, db:migrate, prisma migrate, etc.). You must NEVER create or modify files in any migrations/ directory. If a task involves database schema changes, ONLY update the TypeScript schema definition files — do NOT attempt to generate or run migrations. The user will handle all database operations separately.`

    const labels = task.taskLabels?.map((tl: any) => tl.label?.name).filter(Boolean) || []
    const labelsContext = labels.length > 0
      ? `\n\n[TASK TYPE: ${labels.join(', ')}]`
      : '\n\n[TASK TYPE: none — no labels assigned]'

    let message = `${platformRule}\n\n${securityRule}\n\n${databaseRule}${labelsContext}\n\n${task.title}${task.description ? `\n\n${task.description}` : ''}`

    if (feedback) {
      if (feedback.includes('[USER MESSAGE]')) {
        // Load conversation history so the agent doesn't forget past work
        // when a new opencode process is spawned.
        const historyLogs = await db.query.activityLogs.findMany({
          where: eq(schema.activityLogs.taskId, id),
          columns: { action: true, newValue: true, createdAt: true },
          orderBy: [asc(schema.activityLogs.createdAt)],
          limit: 60,
        })
        const historyLines: string[] = []
        for (const l of historyLogs) {
          if (l.action === 'agent_reply' && l.newValue?.message) {
            historyLines.push(`Agent: ${l.newValue.message}`)
          } else if (l.action === 'runtime_log' && l.newValue?.message?.startsWith('User:')) {
            historyLines.push(l.newValue.message)
          }
        }
        const historyContext = historyLines.length > 0
          ? `\n\n[CONVERSATION HISTORY]\n${historyLines.join('\n')}\n`
          : ''

        const feedbackTail = feedback.length > 150 ? feedback.slice(0, 150) + '...' : feedback
        await pushAndPersist(`Including user message: ${feedbackTail}`)

        // Always include the latest codebase changes so the agent can answer accurately
        const changesContext = await getLatestChangesContext(workDir, repoDefaultBranch)
        if (changesContext) {
          await pushAndPersist(`Included latest codebase changes in context`)
        }

        message = `${platformRule}\n\n${securityRule}\n\n${databaseRule}${changesContext}\n\n${historyContext}${feedback}\n\nINSTRUCTION: The user is asking a question about the codebase. ALWAYS look at the [CURRENT CODEBASE STATE] section above to see what files were recently modified or committed, then examine those files before answering. Give specific, accurate answers that reference actual code, file paths, and line numbers from the latest changes.`}
      } else {
        const feedbackTail = feedback.length > 150 ? feedback.slice(0, 150) + '...' : feedback
        await pushAndPersist(`Including PR feedback: ${feedbackTail}`)

        const changesContext = await getLatestChangesContext(workDir, repoDefaultBranch)
        if (changesContext) {
          await pushAndPersist(`Included latest codebase changes in context`)
        }

        message = `CRITICAL MISSION: Fix PR Review Feedback\n\nYou are working on an EXISTING codebase that has received code review feedback. Your ONLY job is to fix the issues described in the feedback below. The code already exists — do NOT create new files unless explicitly required by the feedback.\n\nINSTRUCTIONS:\n1. Read every feedback item carefully\n2. Examine the relevant existing files mentioned in the feedback (file paths and line numbers are provided)\n3. Make precise, targeted code changes to fix EACH issue using edit/write tools\n4. Do NOT skip any feedback item — fix ALL of them\n5. Do NOT assume issues are already resolved — verify by making actual code changes\n6. After fixing all issues, confirm the changes by checking the modified files\n\n[CURRENT CODEBASE STATE]\n${changesContext || '(No local changes detected)'}\n\n[PR FEEDBACK TO ADDRESS]\n${feedback}\n\n[ORIGINAL TASK CONTEXT - for reference only]\n${message}\n\n${securityRule}\n\n${databaseRule}`
      }
    }

    await pushAndPersist(`Exec: ${opencodePath} run --format json --dir ${workDir}`)
    // Stream CWD for live debugging but do NOT persist — avoid leaking paths in comments
    await stream.push(JSON.stringify({ step: `CWD: ${workDir}`, timestamp: Date.now() }))

    // Build a minimal environment to avoid leaking secrets or config paths
    const minimalEnv: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_PLATFORM: repoPlatform,
      NODE_ENV: process.env.NODE_ENV,
      LANG: process.env.LANG,
      LC_ALL: process.env.LC_ALL,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      GITLAB_TOKEN: process.env.GITLAB_TOKEN,
      GITLAB_HOST: process.env.GITLAB_HOST,
    }

    const proc = spawn(opencodePath, [
      'run',
      '--format', 'json',
      '--dangerously-skip-permissions',
      '--dir', workDir,
      message,
    ], {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env: minimalEnv,
    })

    const entry: ProcState = { proc, streams: [], heartbeat: null }
    activeProcesses.set(id, entry)
    addStreamToProc(id, stream, entry)

    // Global runtime timeout to prevent infinite hangs
    const runtimeTimeout = setTimeout(() => {
      if (proc.exitCode === null) {
        const msg = `Runtime timeout reached (${MAX_RUNTIME_MS / 60000} min) — terminating process`
        pushToStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() })).catch(() => {})
        persistLog(msg)
        try { proc.kill('SIGTERM') } catch {}
        setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 5000)
      }
    }, MAX_RUNTIME_MS)

    const heartbeat = setInterval(async () => {
      const idle = Math.round((Date.now() - lastActivity) / 1000)
      const alive = proc.exitCode === null
      // Always report long idle times so users can see if it's stuck
      if (!hasOutput || idle > 30) {
        const msg = alive ? `Waiting for opencode (${idle}s)` : `Process exited (code ${proc.exitCode})`
        await pushToStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
      }
    }, 5000)
    entry.heartbeat = heartbeat

    const parseAndPush = async (line: string) => {
      if (!line.trim()) return
      try {
        const evt = JSON.parse(line)
        const part = evt.part
        let logMsg = ''
        let fullText = ''

        switch (evt.type) {
          case 'step_start':
            logMsg = 'Step started'
            break
          case 'text':
            fullText = typeof part === 'string' ? part : part.text || part.content || ''
            // Capture agent text responses for persistence.
            // The [AGENT_REPLY] marker is added by the frontend, not by opencode,
            // so we track the latest text as the agent's reply.
            if (fullText) {
              agentReplyContent = fullText.trim()
            }
            logMsg = formatTextEvent(part)
            break
          case 'step_finish':
            logMsg = 'Step completed'
            break
          case 'tool_use':
            if (part?.state?.status === 'completed') {
              logMsg = formatToolEvent(part)
              const tool = part?.tool
              const input = part?.state?.input || {}
              if (tool === 'edit' || tool === 'write') {
                editCount++
                const filePath = input.filePath || input.path || 'unknown'
                editedFiles.push(filePath)
              }
            }
            break
          case 'step_error':
            logMsg = `Error: ${part?.error || 'unknown error'}`
            break
          default:
            if (typeof part === 'string') {
              logMsg = part.slice(0, 120)
            }
        }

        if (logMsg || fullText) {
          hasOutput = true
          lastActivity = Date.now()
          const payload: any = { step: logMsg, timestamp: Date.now() }
          if (fullText) payload.agentReply = fullText.trim()
          await pushToStreams(entry, JSON.stringify(payload))
          if (logMsg) persistLog(logMsg)
        }
      } catch (parseErr: any) {
        // Not valid JSON — could be startup logs, errors, or partial output
        lastActivity = Date.now()
        const raw = line.trim().slice(0, 200)
        if (raw) {
          hasOutput = true
          const msg = `opencode output: ${raw}`
          await pushToStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
          persistLog(msg)
        }
      }
    }

    proc.stdout?.on('data', (chunk: Buffer) => {
      lineBuffer += chunk.toString()
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() || ''
      for (const line of lines) {
        if (line.trim()) parseAndPush(line.trim())
      }
    })

    proc.stderr?.on('data', (chunk: Buffer) => {
      lastActivity = Date.now()
      const text = chunk.toString().trim()
      if (!text) return
      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        hasOutput = true
        const level = trimmed.startsWith('ERROR') || trimmed.includes('error:') ? 'ERROR' : 'WARN'
        pushToStreams(entry, JSON.stringify({ step: `[${level}] ${trimmed.slice(0, 200)}`, timestamp: Date.now() })).catch(() => {})
      }
    })

    proc.on('error', async (err) => {
      clearInterval(heartbeat)
      clearTimeout(runtimeTimeout)
      hasOutput = true
      const msg = `Failed to start opencode: ${err.message}`
      await pushToStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
      persistLog(msg)
    })

    proc.on('exit', async (code) => {
      clearInterval(heartbeat)
      clearTimeout(runtimeTimeout)

      if (code === 0 && branchName) {
        try {
          // Log branch state before committing for debugging
          try {
            const { stdout: branchLog } = await execAsync('git log --oneline -5', { cwd: workDir })
            await pushToStreams(entry, JSON.stringify({ step: `Branch commits before: ${branchLog.replace(/\n/g, ' | ')}`, timestamp: Date.now() }))
          } catch {}

          const { stdout: status } = await execAsync('git status --porcelain --untracked-files=all', { cwd: workDir })
          const { stdout: diffOutput } = await execAsync('git diff', { cwd: workDir }).catch(() => ({ stdout: '' }))
          const { stdout: headCommit } = await execAsync('git rev-parse --short HEAD', { cwd: workDir }).catch(() => ({ stdout: 'unknown' }))
          
          // Shared variables for both commit and summary
          let changedFiles: string[] = []
          let diffContent = ''
          let commitMsg = ''

          if (status.trim()) {
            await pushToStreams(entry, JSON.stringify({ step: `Git status:\n${status}`, timestamp: Date.now() }))
            await execAsync('git add -A', { cwd: workDir })

            // Gather actual diff content for a descriptive commit message
            try {
              const { stdout: nameOutput } = await execAsync('git diff --cached --name-only', { cwd: workDir })
              changedFiles = nameOutput.split('\n').map(f => f.trim()).filter(Boolean)
              const { stdout: diffOutput } = await execAsync('git diff --cached --no-ext-diff', { cwd: workDir })
              diffContent = diffOutput
            } catch {}

            const generatedMsg = generateCommitMessageFromDiff(diffContent, changedFiles)
            commitMsg = generatedMsg

            await execAsync(`git commit -m "${commitMsg}"`, { cwd: workDir })
            await pushToStreams(entry, JSON.stringify({ step: `Committed: ${commitMsg}`, timestamp: Date.now() }))

            // Ensure remote URL has auth token before pushing
            await configureGitAuth(workDir, repoUrl, repoPlatform, repoToken)

            // Try normal push first — only force-push on explicit failure with logging
            try {
              await execAsync(`git push -u origin ${branchName}`, { cwd: workDir })
            } catch (pushErr: any) {
              await pushToStreams(entry, JSON.stringify({ step: `Push rejected: ${pushErr.message}. Force pushing...`, timestamp: Date.now() }))
              await execAsync(`git push --force -u origin ${branchName}`, { cwd: workDir })
            }
            await pushToStreams(entry, JSON.stringify({ step: 'Pushed changes to branch', timestamp: Date.now() }))

            // Log branch state after push for verification
            try {
              const { stdout: branchLogAfter } = await execAsync('git log --oneline -5', { cwd: workDir })
              await pushToStreams(entry, JSON.stringify({ step: `Branch commits after: ${branchLogAfter.replace(/\n/g, ' | ')}`, timestamp: Date.now() }))
            } catch {}
          } else {
            // Detailed debugging when no changes detected
            const editInfo = editCount > 0 ? `Agent claimed ${editCount} edit(s) on: ${editedFiles.join(', ')}` : 'Agent made no tracked edits'
            await pushToStreams(entry, JSON.stringify({ step: `No changes to push. ${editInfo}. HEAD: ${headCommit || 'unknown'}. Diff:\n${diffOutput || '(empty)'}`, timestamp: Date.now() }))
            
            // If agent claimed edits but git shows nothing, log detailed file state
            if (editCount > 0) {
              for (const file of editedFiles.slice(0, 3)) {
                try {
                  const fullPath = path.join(workDir, file)
                  const content = readFileSync(fullPath, 'utf-8').slice(0, 200)
                  await pushToStreams(entry, JSON.stringify({ step: `File state ${file}: ${content.replace(/\n/g, ' ')}`, timestamp: Date.now() }))
                } catch (err: any) {
                  await pushToStreams(entry, JSON.stringify({ step: `Could not read ${file}: ${err.message}`, timestamp: Date.now() }))
                }
              }
            }
            
            // Check if any tracked files were modified but then reverted
            try {
              const { stdout: trackedFiles } = await execAsync('git ls-files -m', { cwd: workDir })
              if (trackedFiles.trim()) {
                await pushToStreams(entry, JSON.stringify({ step: `WARNING: Modified tracked files found but not in status: ${trackedFiles.trim()}`, timestamp: Date.now() }))
              }
            } catch {}
          }

          // Auto-create PR/MR
          try {
            const baseUrl = `${getRequestProtocol(event)}://${getRequestHost(event)}`
            const res = await fetch(`${baseUrl}/api/tasks/${id}/pr`, {
              method: 'POST',
              headers: { cookie: getRequestHeaders(event).cookie || '' },
            })
            if (res.ok) {
              const prResult = await res.json() as { url: string | null; noChanges?: boolean }
              if (prResult?.url) {
                await pushToStreams(entry, JSON.stringify({ step: `Created PR: ${prResult.url}`, timestamp: Date.now() }))
              } else if (prResult?.noChanges) {
                await pushToStreams(entry, JSON.stringify({ step: 'No changes to create PR from', timestamp: Date.now() }))
              }
            } else {
              const errorBody = await res.text().catch(() => '')
              const errorMsg = errorBody.slice(0, 400) || `HTTP ${res.status}`
              await pushToStreams(entry, JSON.stringify({ step: `Auto-create PR failed: ${errorMsg}`, timestamp: Date.now() }))
            }
          } catch (err: any) {
            const msg = err?.message || String(err)
            await pushToStreams(entry, JSON.stringify({ step: `Auto-create PR failed: ${msg}`, timestamp: Date.now() }))
          }

          // Agent reply was already persisted in real-time if [AGENT_REPLY] was detected.
          // We no longer post auto-generated diff summaries to avoid replacing actual agent comments.
          if (agentReplyContent) {
            await pushToStreams(entry, JSON.stringify({ step: 'Agent reply already posted to comments', timestamp: Date.now() }))
          }
        } catch (err: any) {
          await pushToStreams(entry, JSON.stringify({ step: `Push failed: ${err.message}`, timestamp: Date.now() }))
        }
      }

      const msg = code === 0 ? 'Done' : `Exited with code ${code}`
      await pushToStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
      persistLog(msg)

      // Persist the agent's final text response so it survives page refresh.
      if (agentReplyContent) {
        try {
          await db.insert(schema.activityLogs).values({
            taskId: id,
            userId: user.id,
            action: 'agent_reply',
            newValue: { message: agentReplyContent },
          })
        } catch (err: any) {
          console.error('[execute.get] Failed to persist agent_reply:', err?.message || err)
        }
      }

      // ── Clean up worktree after completion ──
      if (workDir && mainCloneDir && workDir !== mainCloneDir) {
        try {
          await pushAndPersist(`Cleaning up worktree...`)
          // Remove the worktree from git's tracking
          try {
            await execAsync(`git worktree remove --force "${workDir}"`, { cwd: mainCloneDir })
            await pushAndPersist(`Worktree removed from git`)
          } catch (removeErr: any) {
            // If git worktree remove fails, force-delete the directory
            await pushAndPersist(`Git worktree remove failed: ${removeErr.message}. Force-deleting directory...`)
            try {
              await execAsync(`rm -rf "${workDir}"`)
              await pushAndPersist(`Worktree directory force-deleted`)
            } catch (rmErr: any) {
              await pushAndPersist(`Failed to delete worktree directory: ${rmErr.message}`)
            }
          }
          // Prune any stale worktree references
          try {
            await execAsync('git worktree prune', { cwd: mainCloneDir })
          } catch {}
          // Clean up the local branch if it exists and is fully merged
          if (branchName && branchName !== repoDefaultBranch) {
            try {
              await execAsync(`git branch -d ${branchName}`, { cwd: mainCloneDir })
              await pushAndPersist(`Local branch ${branchName} deleted`)
            } catch (branchErr: any) {
              // Branch might not be fully merged or doesn't exist — log and continue
              await pushAndPersist(`Could not delete local branch ${branchName}: ${branchErr.message}`)
            }
          }
        } catch (cleanupErr: any) {
          await pushAndPersist(`Worktree cleanup failed: ${cleanupErr.message}`)
        }
      }

      activeProcesses.delete(id)
      for (const s of entry.streams) {
        try { s.close() } catch {}
      }
    })
  }, 10)

  return stream.send()
})
