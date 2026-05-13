import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, and, or, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)

  const db = getDb()

  // Resolve workspace repositories and tasks
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
    return {
      stats: {
        totalOpen: 0,
        awaitingReview: 0,
        needsAgentFix: 0,
        stale: 0,
        agentBacklog: 0,
        mergeBlocked: 0,
        highFriction: 0,
        avgReviewTimeMs: 0,
      },
      staleReviews: [],
      agentBacklog: [],
      mergeBlocked: [],
      highFriction: [],
    }
  }

  const prConditions: any[] = []
  if (repoIds.length > 0 && taskIds.length > 0) {
    prConditions.push(
      or(
        inArray(schema.pullRequests.repositoryId, repoIds),
        inArray(schema.pullRequests.taskId, taskIds)
      )!
    )
  } else if (repoIds.length > 0) {
    prConditions.push(inArray(schema.pullRequests.repositoryId, repoIds))
  } else if (taskIds.length > 0) {
    prConditions.push(inArray(schema.pullRequests.taskId, taskIds))
  }

  let allPrs: any[] = []
  try {
    allPrs = await db.query.pullRequests.findMany({
      where: and(...prConditions),
      with: {
        task: {
          columns: { id: true, title: true, assigneeType: true, agentAssigneeId: true },
          with: {
            agentAssignee: { columns: { id: true, name: true, color: true, initials: true } },
          },
        },
      },
    })
  } catch (err: any) {
    console.error('Failed to query pull requests for bottlenecks:', err)
  }

  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  const openPrs = allPrs.filter((pr) => pr.status === 'open')

  const staleReviews = openPrs.filter((pr) => {
    const age = now - new Date(pr.createdAt).getTime()
    return age > 3 * dayMs && pr.reviewState === 'pending'
  })

  const agentBacklog = openPrs.filter((pr) => {
    const age = now - new Date(pr.updatedAt).getTime()
    return pr.reviewState === 'changes_requested' && pr.agentFixStatus === 'none' && age > 2 * dayMs
  })

  const mergeBlocked = openPrs.filter(
    (pr) => pr.mergeableState === 'dirty' || pr.mergeableState === 'conflicting'
  )

  const highFriction = openPrs.filter((pr) => pr.reviewState === 'changes_requested')

  // Velocity approximation: PRs that were approved
  const approvedPrs = allPrs.filter((pr) => pr.reviewState === 'approved')

  const avgReviewTime = approvedPrs.length > 0
    ? approvedPrs.reduce((sum, pr) => {
        const created = new Date(pr.createdAt).getTime()
        const updated = new Date(pr.updatedAt).getTime()
        return sum + (updated - created)
      }, 0) / approvedPrs.length
    : 0

  return {
    stats: {
      totalOpen: openPrs.length,
      awaitingReview: openPrs.filter((pr) => pr.reviewState === 'pending').length,
      needsAgentFix: openPrs.filter((pr) => pr.reviewState === 'changes_requested').length,
      stale: staleReviews.length,
      agentBacklog: agentBacklog.length,
      mergeBlocked: mergeBlocked.length,
      highFriction: highFriction.length,
      avgReviewTimeMs: avgReviewTime,
    },
    staleReviews: staleReviews.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    agentBacklog: agentBacklog.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()),
    mergeBlocked,
    highFriction,
  }
})
