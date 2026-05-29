import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { parseGithubUrl, parseGitlabUrl, fetchPullRequestDetails, fetchPullRequestReviews, fetchGitlabMergeRequestDetails, determineReviewState } from '~/server/utils/github-api'
import { executeResolveConflicts } from '~/server/utils/resolve-conflicts'

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

  const pr = await db.query.pullRequests.findFirst({
    where: eq(schema.pullRequests.id, id),
    with: { repository: { columns: { url: true, token: true } } },
  })

  if (!pr) throw createError({ statusCode: 404, statusMessage: 'Pull request not found' })

  const gh = parseGithubUrl(pr.url)
  const gl = !gh ? parseGitlabUrl(pr.url) : null
  if (!gh && !gl) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid PR URL format' })
  }

  try {
    let details: { title: string; status: string; draft: boolean; mergeableState: string | null; headBranch: string | null; baseBranch: string | null; createdAt: Date; updatedAt: Date }
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
    }

    // Determine conflict status based on mergeableState
    const newConflictStatus = hasConflicts(details.mergeableState)
      ? pr.conflictStatus === 'in_progress' ? 'in_progress' : 'has_conflicts'
      : pr.conflictStatus === 'resolved' || pr.conflictStatus === 'in_progress'
        ? 'resolved'
        : 'none'

    const updated = await db.update(schema.pullRequests)
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
      .where(eq(schema.pullRequests.id, id))
      .returning()

    // Auto-trigger conflict resolution if conflicts detected and not already in progress
    if (hasConflicts(details.mergeableState) && pr.conflictStatus !== 'in_progress') {
      try {
        await executeResolveConflicts(pr.id, user.id)
      } catch (err: any) {
        console.error(`[sync] Failed to auto-resolve conflicts for PR ${pr.id}:`, err.message)
        await db.update(schema.pullRequests)
          .set({ conflictStatus: 'failed' })
          .where(eq(schema.pullRequests.id, pr.id))
      }
    }

    return { pullRequest: updated[0], synced: true }
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: `Sync failed: ${err.message}` })
  }
})
