import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { getGitDiff, resolveCloneDir } from '~/server/utils/github-api'

const projectsDir = `${process.env.HOME || '/Users/zeinersyad'}/orbit-projects`

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
    return { files: [], totalAdditions: 0, totalDeletions: 0, rawDiff: '' }
  }

  const cloneDir = resolveCloneDir(projectsDir, repo.url, repo.name)
  const baseBranch = pr.baseBranch || repo.defaultBranch || 'main'
  const headBranch = pr.headBranch || pr.task?.branchName || ''

  if (!headBranch) {
    return { files: [], totalAdditions: 0, totalDeletions: 0, rawDiff: '' }
  }

  try {
    const result = await getGitDiff(cloneDir, `origin/${baseBranch}`, `origin/${headBranch}`)
    return result
  } catch {
    return { files: [], totalAdditions: 0, totalDeletions: 0, rawDiff: '' }
  }
})
