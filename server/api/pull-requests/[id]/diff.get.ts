import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { resolveCloneDir } from '~/server/utils/github-api'

const execAsync = promisify(exec)

const projectsDir = `${process.env.HOME || '/Users/zeinersyad'}/orbit-projects`

async function runGitDiff(repoDir: string, base: string, head: string) {
  const { stdout: diffStat } = await execAsync(`git diff --stat ${base}...${head}`, { cwd: repoDir })
  const { stdout: diffOutput } = await execAsync(`git diff ${base}...${head}`, { cwd: repoDir })

  const files: { path: string; additions: number; deletions: number }[] = []
  let totalAdditions = 0
  let totalDeletions = 0

  for (const line of diffStat.split('\n')) {
    const match = line.match(/^(.+?)\s+\|\s+(\d+)\s+([\-+]+)$/)
    if (match) {
      const path = match[1].trim()
      const adds = (match[3].match(/\+/g) || []).length
      const dels = (match[3].match(/-/g) || []).length
      files.push({ path, additions: adds, deletions: dels })
      totalAdditions += adds
      totalDeletions += dels
    }
  }

  return { files, totalAdditions, totalDeletions, rawDiff: diffOutput }
}

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)

  const db = getDb()

  const pr = await db.query.pullRequests.findFirst({
    where: eq(schema.pullRequests.id, id),
    with: {
      repository: { columns: { id: true, name: true, url: true, defaultBranch: true } },
      task: { columns: { id: true, branchName: true } },
    },
  })

  if (!pr) throw createError({ statusCode: 404, statusMessage: 'Pull request not found' })

  const repo = pr.repository
  if (!repo) {
    return { files: [], totalAdditions: 0, totalDeletions: 0, rawDiff: '', error: 'No repository linked' }
  }

  const cloneDir = resolveCloneDir(projectsDir, repo.url, repo.name)
  const baseBranch = pr.baseBranch || repo.defaultBranch || 'main'
  const headBranch = pr.headBranch || pr.task?.branchName || ''

  if (!headBranch) {
    return { files: [], totalAdditions: 0, totalDeletions: 0, rawDiff: '', error: 'No head branch found' }
  }

  if (!existsSync(cloneDir)) {
    return { files: [], totalAdditions: 0, totalDeletions: 0, rawDiff: '', error: `Clone dir not found: ${cloneDir}` }
  }

  // Try fetching both branches first so the remote refs exist locally
  try {
    await execAsync(`git fetch origin ${baseBranch} ${headBranch}`, { cwd: cloneDir })
  } catch (fetchErr: any) {
    console.warn(`[diff.get] Fetch failed for ${baseBranch} and ${headBranch}:`, fetchErr.message)
  }

  const strategies = [
    [`origin/${baseBranch}`, `origin/${headBranch}`],
    [baseBranch, headBranch],
    [`remotes/origin/${baseBranch}`, `remotes/origin/${headBranch}`],
  ]

  let lastError = ''
  for (const [base, head] of strategies) {
    try {
      const result = await runGitDiff(cloneDir, base, head)
      if (result.files.length > 0 || result.rawDiff.length > 0) {
        return result
      }
      // Empty but valid — keep trying other strategies
    } catch (e: any) {
      lastError = e.message
      console.warn(`[diff.get] Diff strategy failed [${base}...${head}]:`, e.message)
    }
  }

  return { files: [], totalAdditions: 0, totalDeletions: 0, rawDiff: '', error: lastError || 'All diff strategies returned empty' }
})
