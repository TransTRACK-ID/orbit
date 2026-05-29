import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, readFileSync } from 'fs'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { pendingFeedback } from '~/server/utils/runtime'
import { parseGithubUrl, parseGitlabUrl } from '~/server/utils/github-api'
import { injectTokenIntoRemoteUrl } from '~/server/utils/git-helpers'
import { resolveCloneDir, resolveWorktreeDir, projectsDir } from '~/server/utils/worktree-resolver'

const execAsync = promisify(exec)

export interface ResolveConflictResult {
  success: true
  taskId: string
  conflictCount: number
  pullRequestId: string
  hasConflicts: boolean
}

interface ConflictFile {
  path: string
  ours: string
  theirs: string
  base: string
  conflictMarkers: Array<{
    start: number
    end: number
    oursContent: string
    theirsContent: string
  }>
}

async function collectConflictFiles(workDir: string, repoDefaultBranch: string, branchName: string): Promise<ConflictFile[]> {
  const conflicts: ConflictFile[] = []

  // Get list of conflicted files
  const { stdout: conflictList } = await execAsync(
    'git diff --name-only --diff-filter=U',
    { cwd: workDir }
  ).catch(() => ({ stdout: '' }))

  const files = conflictList.trim().split('\n').filter(Boolean)

  for (const filePath of files) {
    const fullPath = `${workDir}/${filePath}`
    if (!existsSync(fullPath)) continue

    const content = readFileSync(fullPath, 'utf-8')
    const lines = content.split('\n')

    const conflictMarkers: Array<{
      start: number
      end: number
      oursContent: string
      theirsContent: string
    }> = []

    let currentStart = -1
    let oursBuffer: string[] = []
    let theirsBuffer: string[] = []
    let inOurs = false
    let inTheirs = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line.startsWith('<<<<<<<')) {
        currentStart = i
        inOurs = true
        inTheirs = false
        oursBuffer = []
        theirsBuffer = []
      } else if (line.startsWith('=======') && inOurs) {
        inOurs = false
        inTheirs = true
      } else if (line.startsWith('>>>>>>>') && inTheirs) {
        conflictMarkers.push({
          start: currentStart,
          end: i,
          oursContent: oursBuffer.join('\n'),
          theirsContent: theirsBuffer.join('\n'),
        })
        inOurs = false
        inTheirs = false
      } else if (inOurs) {
        oursBuffer.push(line)
      } else if (inTheirs) {
        theirsBuffer.push(line)
      }
    }

    if (conflictMarkers.length > 0) {
      // Get the base version (common ancestor)
      let baseContent = ''
      try {
        const { stdout: base } = await execAsync(
          `git show :1:"${filePath}"`,
          { cwd: workDir }
        )
        baseContent = base
      } catch {
        baseContent = '(unable to retrieve base version)'
      }

      conflicts.push({
        path: filePath,
        ours: content,
        theirs: '', // We'll get this from the merge
        base: baseContent,
        conflictMarkers,
      })
    }
  }

  return conflicts
}

function buildConflictResolutionPrompt(conflicts: ConflictFile[], branchName: string, baseBranch: string): string {
  const sections: string[] = []

  sections.push(`# MERGE CONFLICT RESOLUTION REQUIRED

Your branch "${branchName}" has conflicts with the base branch "${baseBranch}". You need to resolve these conflicts intelligently.

## CONFLICT RESOLUTION RULES (CRITICAL):

1. **Preserve YOUR changes**: Keep all the code you wrote (the task implementation) - this is the primary goal
2. **Integrate THEIR changes**: If the base branch has new code in the same area, merge both versions intelligently
3. **When both versions add different features**: Combine them by including both code blocks in the correct order
4. **When both versions modify the same line**: Choose the more complete/updated version, or combine the logic
5. **Never just pick one side blindly**: Always analyze what each side is trying to do
6. **Delete conflict markers**: Remove all <<<<<<<, =======, and >>>>>>> lines
7. **Ensure valid syntax**: The file must be syntactically valid after resolution
8. **Preserve imports**: Keep all imports from both versions

## CONFLICTED FILES:

${conflicts.map((c, idx) => {
  const markers = c.conflictMarkers.map((m, mIdx) => `
### Conflict ${mIdx + 1}:

**YOUR VERSION (ours):**
\`\`\`
${m.oursContent.slice(0, 500)}${m.oursContent.length > 500 ? '\n... (truncated)' : ''}
\`\`\`

**THEIR VERSION (theirs):**
\`\`\`
${m.theirsContent.slice(0, 500)}${m.theirsContent.length > 500 ? '\n... (truncated)' : ''}
\`\`\`

**BASE VERSION (common ancestor):**
\`\`\`
${c.base.slice(0, 300)}${c.base.length > 300 ? '\n... (truncated)' : ''}
\`\`\`
`).join('\n')

  return `\n## File ${idx + 1}: ${c.path}\n${markers}\n`
}).join('\n')}

## INSTRUCTIONS:

1. For each conflicted file, analyze what changes each side made
2. Decide how to merge them (combine both, pick yours, or create a hybrid)
3. Edit the files to remove all conflict markers and produce clean code
4. After resolving all conflicts, run 'git add -A' to stage the resolved files
5. Do NOT commit - the system will commit for you

Resolve these conflicts now by editing the files directly.`)

  return sections.join('\n')
}

export async function executeResolveConflicts(prId: string, userId: string): Promise<ResolveConflictResult> {
  const db = getDb()

  const pr = await db.query.pullRequests.findFirst({
    where: eq(schema.pullRequests.id, prId),
    with: {
      task: {
        columns: {
          id: true,
          title: true,
          repositoryId: true,
          branchName: true,
          projectId: true,
        },
      },
      repository: {
        columns: { url: true, token: true, platform: true, defaultBranch: true },
      },
    },
  })

  if (!pr) throw createError({ statusCode: 404, statusMessage: 'Pull request not found' })
  if (!pr.task) throw createError({ statusCode: 400, statusMessage: 'No task linked to this pull request' })

  const taskId = pr.task.id
  const repoUrl = pr.repository?.url || ''
  const repoDefaultBranch = pr.repository?.defaultBranch || 'main'
  const repoToken = pr.repository?.token || null
  const repoPlatform = (pr.repository?.platform as 'github' | 'gitlab' | 'gitlab-self-hosted') || 'github'
  const branchName = pr.headBranch || pr.task.branchName || ''

  if (!repoUrl) {
    throw createError({ statusCode: 400, statusMessage: 'No repository configured for this pull request' })
  }

  const mainCloneDir = resolveCloneDir(repoUrl, pr.repository?.name || '', projectsDir)
  const workDir = resolveWorktreeDir(mainCloneDir, taskId)

  // Check if worktree exists
  const hasWorktree = existsSync(workDir)

  if (!hasWorktree) {
    // Try to restore the worktree from the remote branch
    try {
      await execAsync(`git fetch origin ${branchName}`, { cwd: mainCloneDir })
      await execAsync(
        `git worktree add "${workDir}" ${branchName}`,
        { cwd: mainCloneDir }
      )
    } catch (err: any) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to restore worktree for conflict resolution: ${err.message}`,
      })
    }
  }

  // Inject auth token
  if (repoToken) {
    const authUrl = injectTokenIntoRemoteUrl(repoUrl, repoPlatform, repoToken)
    if (authUrl !== repoUrl) {
      try {
        await execAsync(`git remote set-url origin ${authUrl}`, { cwd: workDir })
      } catch {}
    }
  }

  // Fetch latest from both branches
  try {
    await execAsync(`git fetch origin ${repoDefaultBranch}`, { cwd: workDir })
    await execAsync(`git fetch origin ${branchName}`, { cwd: workDir })
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch latest changes: ${err.message}`,
    })
  }

  // Attempt to merge the base branch into our branch
  let mergeOutput = ''
  let hasConflicts = false
  try {
    const { stdout } = await execAsync(
      `git merge origin/${repoDefaultBranch} --no-commit --no-ff`,
      { cwd: workDir }
    )
    mergeOutput = stdout
  } catch (err: any) {
    mergeOutput = err.stdout || ''
    // Check if it's a conflict
    if (err.message?.includes('conflict') || err.message?.includes('CONFLICT')) {
      hasConflicts = true
    }
  }

  // Check for conflicts using git status
  const { stdout: statusOutput } = await execAsync(
    'git status --porcelain',
    { cwd: workDir }
  ).catch(() => ({ stdout: '' }))

  const conflictedFiles = statusOutput
    .split('\n')
    .filter((line: string) => line.startsWith('UU'))
    .map((line: string) => line.slice(3).trim())

  if (conflictedFiles.length === 0) {
    // No conflicts - merge was clean or already resolved
    // Abort the merge and let the normal flow handle it
    try {
      await execAsync('git merge --abort', { cwd: workDir })
    } catch {}

    // Update PR status
    await db.update(schema.pullRequests)
      .set({ conflictStatus: 'resolved', lastSyncedAt: new Date() })
      .where(eq(schema.pullRequests.id, prId))

    return {
      success: true,
      taskId,
      conflictCount: 0,
      pullRequestId: prId,
      hasConflicts: false,
    }
  }

  hasConflicts = true

  // Collect detailed conflict information
  const conflicts = await collectConflictFiles(workDir, repoDefaultBranch, branchName)

  if (conflicts.length === 0) {
    // Conflicts detected but couldn't parse them
    try {
      await execAsync('git merge --abort', { cwd: workDir })
    } catch {}

    throw createError({
      statusCode: 500,
      statusMessage: 'Conflicts detected but could not parse conflict details',
    })
  }

  // Build the conflict resolution prompt
  const conflictPrompt = buildConflictResolutionPrompt(conflicts, branchName, repoDefaultBranch)

  // Store the conflict resolution prompt as feedback
  pendingFeedback.set(taskId, conflictPrompt)

  // Update PR conflict status
  await db.update(schema.pullRequests)
    .set({ conflictStatus: 'in_progress', lastSyncedAt: new Date() })
    .where(eq(schema.pullRequests.id, prId))

  // Log the action
  try {
    await db.insert(schema.activityLogs).values({
      taskId,
      userId,
      action: 'resolve_conflicts',
      newValue: {
        message: `Agent resolving ${conflicts.length} merge conflicts in PR`,
        pullRequestId: prId,
        conflictCount: conflicts.length,
      },
    })
  } catch {}

  return {
    success: true,
    taskId,
    conflictCount: conflicts.length,
    pullRequestId: prId,
    hasConflicts: true,
  }
}
