import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, and, inArray, or } from 'drizzle-orm'
import {
  parseGithubUrl,
  parseGitlabUrl,
  fetchPullRequestDetails,
  fetchPullRequestReviews,
  fetchGitlabMergeRequestDetails,
  determineReviewState,
} from '~/server/utils/github-api'
import { executeResolveConflicts } from '~/server/utils/resolve-conflicts'

const CONCURRENCY = 5

async function pMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = []
  let index = 0

  async function worker() {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i])
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

function hasConflicts(mergeableState: string | null): boolean {
  if (!mergeableState) return false
  const conflictStates = [
    'dirty',           // GitHub: branch is out of date
    'conflicting',       // GitHub: merge conflict
    'has_conflicts',     // GitLab: has conflicts
    'cannot_be_merged',  // GitLab: cannot be merged (conflicts)
    'unresolvable',      // GitLab: unresolvable conflicts
  ]
  return conflictStates.includes(mergeableState)
}

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)

  const db = getDb()

  // Gather all repos and tasks in this workspace
  const repos = await db.query.repositories.findMany({
    where: eq(schema.repositories.workspaceId, id),
    columns: { id: true },
  })
  const repoIds = repos.map((r) => r.id)

  const projects = await db.query.projects.findMany({
    where: eq(schema.projects.workspaceId, id),
    columns: { id: true },
  })
  const projectIds = projects.map((p) => p.id)

  const tasks = await db.query.tasks.findMany({
    where: inArray(schema.tasks.projectId, projectIds),
    columns: { id: true },
  })
  const taskIds = tasks.map((t) => t.id)

  if (repoIds.length === 0 && taskIds.length === 0) {
    return { synced: 0, failed: 0, conflictsResolved: 0, conflictsFailed: 0 }
  }

  // Fetch all open PRs belonging to this workspace
  const conditions: any[] = []
  if (repoIds.length > 0 && taskIds.length > 0) {
    conditions.push(
      or(
        inArray(schema.pullRequests.repositoryId, repoIds),
        inArray(schema.pullRequests.taskId, taskIds)
      )!
    )
  } else if (repoIds.length > 0) {
    conditions.push(inArray(schema.pullRequests.repositoryId, repoIds))
  } else {
    conditions.push(inArray(schema.pullRequests.taskId, taskIds))
  }

  // Only sync open PRs — closed/merged are already final
  conditions.push(eq(schema.pullRequests.status, 'open'))

  const prs = await db.query.pullRequests.findMany({
    where: and(...conditions),
    with: { repository: { columns: { url: true, token: true } } },
  })

  let synced = 0
  let failed = 0
  let conflictsResolved = 0
  let conflictsFailed = 0

  await pMap(
    prs,
    async (pr) => {
      const gh = parseGithubUrl(pr.url)
      const gl = !gh ? parseGitlabUrl(pr.url) : null
      if (!gh && !gl) return

      try {
        let details: {
          title: string
          status: string
          draft: boolean
          mergeableState: string | null
          headBranch: string | null
          baseBranch: string | null
          createdAt: Date
          updatedAt: Date
        }
        let reviewState: 'pending' | 'approved' | 'changes_requested' | 'commented' = 'pending'

        if (gh) {
          details = await fetchPullRequestDetails(
            gh.owner, gh.repo, gh.number, gh.host, gh.isEnterprise,
            pr.repository?.token
          )
          const reviews = await fetchPullRequestReviews(
            gh.owner, gh.repo, gh.number, gh.host, gh.isEnterprise,
            pr.repository?.token
          )
          reviewState = determineReviewState(reviews)
        } else if (gl) {
          details = await fetchGitlabMergeRequestDetails(
            gl.projectPath, gl.iid, gl.host, pr.repository?.token
          )
        } else {
          return
        }

        // Determine conflict status based on mergeableState
        const newConflictStatus = hasConflicts(details.mergeableState)
          ? pr.conflictStatus === 'in_progress' ? 'in_progress' : 'has_conflicts'
          : pr.conflictStatus === 'resolved' || pr.conflictStatus === 'in_progress'
            ? 'resolved'
            : 'none'

        await db
          .update(schema.pullRequests)
          .set({
            title: details.title,
            status: details.status,
            draft: details.draft,
            reviewState,
            mergeableState: details.mergeableState,
            conflictStatus: newConflictStatus,
            headBranch: details.headBranch,
            baseBranch: details.baseBranch,
            createdAt: details.createdAt,
            updatedAt: details.updatedAt,
            lastSyncedAt: new Date(),
          })
          .where(eq(schema.pullRequests.id, pr.id))

        synced++

        // Auto-trigger conflict resolution if conflicts detected and not already in progress
        if (hasConflicts(details.mergeableState) && pr.conflictStatus !== 'in_progress') {
          try {
            const result = await executeResolveConflicts(pr.id, user.id)
            if (result.hasConflicts) {
              conflictsResolved++
            }
          } catch (err: any) {
            console.error(`[sync-all] Failed to resolve conflicts for PR ${pr.id}:`, err.message)
            conflictsFailed++
            // Update conflict status to failed
            await db
              .update(schema.pullRequests)
              .set({ conflictStatus: 'failed' })
              .where(eq(schema.pullRequests.id, pr.id))
          }
        }
      } catch (err: any) {
        console.error(`[sync-all] Failed to sync PR ${pr.id}:`, err.message)
        failed++
      }
    },
    CONCURRENCY
  )

  return { synced, failed, conflictsResolved, conflictsFailed }
})
