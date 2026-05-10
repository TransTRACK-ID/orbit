import { createEventStream, getQuery, getRequestProtocol, getRequestHost, getRequestHeaders } from 'h3'
import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import { accessSync, constants, existsSync, mkdirSync, readFileSync } from 'fs'
import path from 'path'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, asc } from 'drizzle-orm'

const execAsync = promisify(exec)

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

import { activeProcesses, addStreamToProc, pushToStreams, pendingFeedback } from '~/server/utils/runtime'
import type { ProcState } from '~/server/utils/runtime'
import { getDiffSummary } from '~/server/utils/git-summary'

/**
 * Generate a human-readable commit message from the actual git diff.
 * Describes WHAT changed (content / behavior) instead of just WHICH files.
 */
function generateCommitMessageFromDiff(diffContent: string, changedFiles: string[]): string {
  const files = changedFiles.filter(f => f.trim())
  if (files.length === 0) return 'update files'

  // --- Parse diff lines into added / removed meaningful content ---
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

  // --- Helper: extract meaningful tokens ---
  const extractTokens = (lines: string[]): string[] => {
    const tokens: string[] = []
    for (const line of lines) {
      // Tailwind / CSS color classes: bg-red-500, text-blue-600, etc.
      const colorMatch = line.match(/\b(bg|text|border|color|fill|stroke|ring|shadow|outline|decoration)-([a-z]+-[0-9]+|current|transparent|white|black|inherit|primary|secondary)\b/)
      if (colorMatch) tokens.push(`${colorMatch[1]} color ${colorMatch[2]}`)

      // Hex colors
      const hexMatch = line.match(/#([0-9a-fA-F]{3,8})\b/)
      if (hexMatch) tokens.push(`color #${hexMatch[1]}`)

      // New component / element tags: <NewComponent or <div class="...">
      const tagMatch = line.match(/<([A-Z][a-zA-Z0-9_-]+)/)
      if (tagMatch) tokens.push(`component ${tagMatch[1]}`)

      // Attribute / prop changes
      const propMatch = line.match(/\b([a-zA-Z0-9-:]+)=/)
      if (propMatch) tokens.push(`property ${propMatch[1]}`)

      // Variable / function names (rough heuristic)
      const funcMatch = line.match(/\b(function|const|let|var|def|class)\s+([a-zA-Z0-9_]+)/)
      if (funcMatch) tokens.push(`${funcMatch[1]} ${funcMatch[2]}`)

      // Import additions
      const importMatch = line.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/)
      if (importMatch) tokens.push(`import ${importMatch[1].split('/').pop()}`)

      // Event handlers / callbacks
      const eventMatch = line.match(/\b(on[A-Z][a-zA-Z0-9]+|@click|@submit|@change|@input|v-on:)/)
      if (eventMatch) tokens.push(`event handler`)

      // Conditional logic
      const logicMatch = line.match(/\b(if|else|while|for|switch|try|catch)\b/)
      if (logicMatch) tokens.push(`${logicMatch[1]} logic`)
    }
    return tokens
  }

  const addedTokens = extractTokens(addedLines)
  const removedTokens = extractTokens(removedLines)

  // --- Detect specific change patterns ---

  // 1. Color / style change (most common in Vue + Tailwind)
  const addedColors = addedTokens.filter(t => t.includes('color'))
  const removedColors = removedTokens.filter(t => t.includes('color'))
  if (addedColors.length > 0 || removedColors.length > 0) {
    const colorDesc = addedColors.length > 0
      ? `to ${addedColors[0].replace('color ', '')}`
      : 'styling'
    const area = files.some(f => f.includes('Sidebar')) ? 'sidebar'
      : files.some(f => f.includes('Header')) ? 'header'
      : files.some(f => f.includes('Footer')) ? 'footer'
      : files.some(f => f.includes('Button')) ? 'button'
      : files.some(f => f.includes('Card')) ? 'card'
      : files.some(f => f.includes('Modal')) ? 'modal'
      : files.some(f => f.includes('Page')) ? 'page'
      : files.some(f => f.includes('Layout')) ? 'layout'
      : 'component'
    return `change ${area} ${removedColors.length > 0 ? `from ${removedColors[0].replace('color ', '')} ` : ''}${colorDesc}`
  }

  // 2. New component / element added
  const addedComponents = addedTokens.filter(t => t.startsWith('component '))
  if (addedComponents.length > 0) {
    return `add ${addedComponents[0].replace('component ', '')} component`
  }

  // 3. New function / method
  const addedFuncs = addedTokens.filter(t => t.startsWith('function '))
  if (addedFuncs.length > 0) {
    return `add ${addedFuncs[0].replace('function ', '')} function`
  }

  // 4. Import changes
  const addedImports = addedTokens.filter(t => t.startsWith('import '))
  if (addedImports.length > 0) {
    return `add ${addedImports[0].replace('import ', '')} import`
  }

  // 5. Event / interaction changes
  if (addedTokens.some(t => t.includes('event handler'))) {
    return 'add event handling'
  }

  // 6. Logic / conditional changes
  const logicChanges = addedTokens.filter(t => t.includes('logic'))
  if (logicChanges.length > 0) {
    return `update ${logicChanges[0]} logic`
  }

  // 7. Text content changes (fallback for string modifications)
  const addedStrings = addedLines.filter(l => l.match(/["']([^"']{3,})["']/))
  const removedStrings = removedLines.filter(l => l.match(/["']([^"']{3,})["']/))
  if (addedStrings.length > 0 || removedStrings.length > 0) {
    const addedText = addedStrings[0]?.match(/["']([^"']{3,})["']/)?.[1] || ''
    const removedText = removedStrings[0]?.match(/["']([^"']{3,})["']/)?.[1] || ''
    if (addedText && removedText) {
      return `update text from "${removedText.slice(0, 20)}" to "${addedText.slice(0, 20)}"`
    } else if (addedText) {
      return `add "${addedText.slice(0, 30)}" text`
    }
  }

  // 8. Fallback: describe file scope with count
  if (files.length === 1) {
    const name = files[0].split('/').pop()?.replace(/\.(vue|ts|js|css|scss)$/i, '') || 'file'
    return `update ${name}`
  } else if (files.length <= 3) {
    const names = files.map(f => f.split('/').pop()?.replace(/\.(vue|ts|js|css|scss)$/i, '') || '').join(', ')
    return `update ${names}`
  } else {
    return `update ${files.length} files`
  }
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

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)

  // Read and clear pending feedback (posted separately to avoid oversized URL params)
  const feedback = pendingFeedback.get(id) || ''
  pendingFeedback.delete(id)

  const db = getDb()
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    columns: { id: true, title: true, description: true, projectId: true, repositoryId: true, agentAssigneeId: true },
    with: {
      agentAssignee: {
        columns: { userId: true },
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
    if (!opencodeOk) {
      await stream.push(JSON.stringify({ step: `opencode not found at ${opencodePath}`, timestamp: Date.now() }))
      return
    }

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
      } catch {}
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

    let workDir = defaultProjectDir
    let branchName = ''
    let repoPlatform: 'github' | 'gitlab' | 'gitlab-self-hosted' = 'github'
    let repoDefaultBranch = 'main'
    let repoUrl = ''
    let repoName = ''

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
          repoPlatform = (workspaceRepos[0].platform as 'github' | 'gitlab' | 'gitlab-self-hosted') || 'github'
        }
      }

      if (repoUrl) {
        repoName = repoName || extractRepoName(repoUrl)
        const cloneDir = `${projectsDir}/${repoName}`

        if (!existsSync(cloneDir)) {
          await pushAndPersist(`Cloning ${repoUrl}...`)
          try {
            mkdirSync(projectsDir, { recursive: true })
            await new Promise<void>((resolve, reject) => {
              const git = spawn('git', ['clone', repoUrl, cloneDir], {
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: false,
              })
              git.on('exit', (code) => {
                code === 0 ? resolve() : reject(new Error(`git clone exited with code ${code}`))
              })
              git.on('error', reject)
            })
            await pushAndPersist(`Cloned to ${cloneDir}`)
          } catch (err: any) {
            await pushAndPersist(`Clone failed: ${err.message}`)
          }
        }

        workDir = cloneDir

        if (createBranch) {
          branchName = `task-${task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)}`
          try {
            const { stdout: branchCheck } = await execAsync(`git branch --list ${branchName}`, { cwd: workDir })
            if (!branchCheck.trim()) {
              // First run: branch doesn't exist — create fresh from clean default
              await execAsync(`git fetch origin ${repoDefaultBranch}`, { cwd: workDir })
              await execAsync(`git checkout ${repoDefaultBranch}`, { cwd: workDir })
              await execAsync(`git reset --hard origin/${repoDefaultBranch}`, { cwd: workDir })
              await pushAndPersist(`Reset ${repoDefaultBranch} to origin state`)
              await execAsync(`git checkout -b ${branchName}`, { cwd: workDir })
              await pushAndPersist(`Created fresh branch "${branchName}" from ${repoDefaultBranch}`)
            } else {
              // Follow-up run: branch exists — continue working on it (preserve progress)
              // Check for any leftover uncommitted changes from a crashed previous run
              const { stdout: leftoverStatus } = await execAsync('git status --porcelain', { cwd: workDir }).catch(() => ({ stdout: '' }))
              if (leftoverStatus.trim()) {
                await pushAndPersist(`WARNING: Uncommitted changes detected before checkout. Stashing...`)
                await execAsync('git stash push -m "auto-stash before agent run"', { cwd: workDir })
              }
              await execAsync(`git checkout ${branchName}`, { cwd: workDir })
              const { stdout: currentBranch } = await execAsync('git branch --show-current', { cwd: workDir })
              const actualBranch = currentBranch.trim()
              if (actualBranch !== branchName) {
                await pushAndPersist(`WARNING: Expected branch ${branchName} but on ${actualBranch}. Retrying checkout...`)
                await execAsync(`git fetch origin ${branchName}`, { cwd: workDir })
                await execAsync(`git checkout -B ${branchName} origin/${branchName}`, { cwd: workDir })
              }
              // Verify branch state
              const { stdout: verifyLog } = await execAsync('git log --oneline -3', { cwd: workDir })
              await pushAndPersist(`Continuing on ${branchName}. Recent commits: ${verifyLog.replace(/\n/g, ' | ')}`)
            }
          } catch (err: any) {
            await pushAndPersist(`Branch setup failed: ${err.message}`)
          }
        } else {
          // User disabled auto-branching: ensure we start from their configured default branch, clean
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

    await pushAndPersist(`Spawning opencode for "${task.title}" in ${workDir}...`)

    const isGitLab = repoPlatform === 'gitlab' || repoPlatform === 'gitlab-self-hosted'
    const platformLabel = isGitLab ? 'GitLab' : 'GitHub'
    const correctCli = isGitLab ? 'glab' : 'gh'
    const wrongCli = isGitLab ? 'gh' : 'glab'
    const platformRule = `[GIT PLATFORM: ${repoPlatform}]
CRITICAL: This repository uses ${platformLabel}. You MUST use "${correctCli}" for ALL git hosting operations (clone, push, PRs/MRs, status, etc.). NEVER use "${wrongCli}" — it will fail.`

    let message = `${platformRule}\n\n${task.title}${task.description ? `\n\n${task.description}` : ''}`

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
        message = `${platformRule}\n\n${historyContext}${feedback}\n\nRead the user message carefully and respond accordingly. You are in a chat context.`
      } else {
        const feedbackTail = feedback.length > 150 ? feedback.slice(0, 150) + '...' : feedback
        await pushAndPersist(`Including PR feedback: ${feedbackTail}`)
        message = `[PR FEEDBACK TO ADDRESS]\n${feedback}\n\n[ORIGINAL TASK]\n${message}\n\nCRITICAL: The PR feedback above was given by a code reviewer. You MUST examine each item carefully and make the necessary code changes to fix ALL reported issues. Do NOT skip any item. Do NOT assume issues are already resolved — verify by making actual code changes. Your goal is to modify the codebase to satisfy each piece of feedback.`
      }
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
      env: { ...process.env, GIT_PLATFORM: repoPlatform },
    })

    const entry: ProcState = { proc, streams: [], heartbeat: null }
    activeProcesses.set(id, entry)
    addStreamToProc(id, stream, entry)

    const heartbeat = setInterval(async () => {
      const idle = Math.round((Date.now() - lastActivity) / 1000)
      const alive = proc.exitCode === null
      if (!hasOutput) {
        const msg = alive ? `Waiting for opencode (${idle}s)` : `Process exited (code ${proc.exitCode})`
        await pushToStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
      }
    }, 5000)
    entry.heartbeat = heartbeat

    const parseAndPush = async (line: string) => {
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
            logMsg = formatTextEvent(part)
            fullText = typeof part === 'string' ? part : part.text || part.content || ''
            if (fullText.trim()) {
              db.insert(schema.activityLogs).values({
                taskId: id,
                userId: user.id,
                action: 'agent_reply',
                newValue: { message: fullText.trim() }
              }).catch(() => {})
            }
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
      } catch {}
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
        if (trimmed.startsWith('ERROR') || trimmed.includes('error:')) {
          hasOutput = true
          pushToStreams(entry, JSON.stringify({ step: trimmed.slice(0, 120), timestamp: Date.now() })).catch(() => {})
        }
      }
    })

    proc.on('error', async (err) => {
      clearInterval(heartbeat)
      hasOutput = true
      const msg = `Failed to start opencode: ${err.message}`
      await pushToStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
      persistLog(msg)
    })

    proc.on('exit', async (code) => {
      clearInterval(heartbeat)

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

            // Create a unique commit message so each run is distinguishable in history
            let commitNum = 1
            try {
              const { stdout: aheadCount } = await execAsync(`git rev-list --count ${repoDefaultBranch}..HEAD`, { cwd: workDir })
              commitNum = parseInt(aheadCount.trim() || '0') + 1
            } catch {}
            const generatedMsg = generateCommitMessageFromDiff(diffContent, changedFiles)
            commitMsg = `${generatedMsg} (#${commitNum})`

            await execAsync(`git commit -m "${commitMsg}"`, { cwd: workDir })
            await pushToStreams(entry, JSON.stringify({ step: `Committed: ${commitMsg}`, timestamp: Date.now() }))

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
            }
          } catch (err: any) {
            await pushToStreams(entry, JSON.stringify({ step: `Auto-create PR failed: ${err.message}`, timestamp: Date.now() }))
          }

          // Log diff summary as runtime_log only (not agent_reply) so it stays
          // in the runtime feed but does NOT appear in the task comments.
          try {
            const summary = await getDiffSummary(workDir, repoDefaultBranch, task.title, task.description)
            if (summary) {
              await db.insert(schema.activityLogs).values({
                taskId: id,
                userId: user.id,
                action: 'runtime_log',
                newValue: { message: `Summary: ${summary}` },
              })
              await pushToStreams(entry, JSON.stringify({ step: 'Posted summary to runtime log', timestamp: Date.now() }))
            }
          } catch (err: any) {
            await pushToStreams(entry, JSON.stringify({ step: `Summary post failed: ${err.message}`, timestamp: Date.now() }))
          }
        } catch (err: any) {
          await pushToStreams(entry, JSON.stringify({ step: `Push failed: ${err.message}`, timestamp: Date.now() }))
        }
      }

      const msg = code === 0 ? 'Done' : `Exited with code ${code}`
      await pushToStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
      persistLog(msg)
      activeProcesses.delete(id)
      for (const s of entry.streams) {
        try { s.close() } catch {}
      }
    })
  }, 10)

  return stream.send()
})
