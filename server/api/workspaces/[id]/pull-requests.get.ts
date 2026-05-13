import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, and, or, desc, inArray } from 'drizzle-orm'
import { parseGithubUrl, fetchPullRequestDetails, fetchPullRequestReviews, determineReviewState } from '~/server/utils/github-api'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const query = getQuery(event)
  await requireAuth(event)

  const db = getDb()

  // Get all repositories in this workspace
  const repos = await db.query.repositories.findMany({
    where: eq(schema.repositories.workspaceId, id),
    columns: { id: true },
  })
  const repoIds = repos.map((r) => r.id)

  // Get all projects in this workspace
  const projects = await db.query.projects.findMany({
    where: eq(schema.projects.workspaceId, id),
    columns: { id: true },
  })
  const projectIds = projects.map((p) => p.id)

  // Get all tasks in those projects
  const tasks = await db.query.tasks.findMany({
    where: inArray(schema.tasks.projectId, projectIds),
    columns: { id: true },
  })
  const taskIds = tasks.map((t) => t.id)

  const statusFilter = query.status as string | undefined
  const reviewStateFilter = query.reviewState as string | undefined
  const repoFilter = query.repositoryId as string | undefined
  const search = query.search as string | undefined

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
  } else if (taskIds.length > 0) {
    conditions.push(inArray(schema.pullRequests.taskId, taskIds))
  } else {
    // No repos or tasks in workspace — return empty
    return { pullRequests: [] }
  }

  if (statusFilter) {
    conditions.push(eq(schema.pullRequests.status, statusFilter))
  }
  if (reviewStateFilter) {
    conditions.push(eq(schema.pullRequests.reviewState, reviewStateFilter))
  }
  if (repoFilter) {
    conditions.push(eq(schema.pullRequests.repositoryId, repoFilter))
  }

  let prs: any[] = []
  try {
    prs = await db.query.pullRequests.findMany({
      where: and(...conditions),
      with: {
        task: {
          columns: { id: true, title: true, assigneeType: true, agentAssigneeId: true, assigneeId: true, branchName: true },
          with: {
            agentAssignee: { columns: { id: true, name: true, color: true, initials: true } },
            assignee: { columns: { id: true, name: true } },
            project: { columns: { id: true, name: true, color: true } },
          },
        },
        repository: { columns: { id: true, name: true, url: true } },
      },
      orderBy: [desc(schema.pullRequests.createdAt)],
    })
  } catch (err: any) {
    console.error('Failed to query pull requests:', err)
  }

  // ── Backfill: discover PRs from activity logs for tasks missing in pull_requests ──
  if (taskIds.length > 0) {
    const existingTaskIds = new Set(prs.map((p) => p.taskId))
    const missingTaskIds = taskIds.filter((tid) => !existingTaskIds.has(tid))

    if (missingTaskIds.length > 0) {
      const logs = await db.query.activityLogs.findMany({
        where: and(
          inArray(schema.activityLogs.taskId, missingTaskIds),
          or(
            eq(schema.activityLogs.action, 'pr_created'),
            eq(schema.activityLogs.action, 'pr_updated')
          )!
        ),
        orderBy: [desc(schema.activityLogs.createdAt)],
      })

      const taskUrlMap = new Map<string, string>()
      for (const log of logs) {
        const url = log.newValue?.url || log.newValue?.prUrl
        if (url && !taskUrlMap.has(log.taskId)) {
          taskUrlMap.set(log.taskId, url)
        }
      }

      let inserted = false
      for (const [taskId, prUrl] of taskUrlMap) {
        const parsed = parseGithubUrl(prUrl)
        if (!parsed) continue

        const task = await db.query.tasks.findFirst({
          where: eq(schema.tasks.id, taskId),
          columns: { repositoryId: true, branchName: true },
          with: { repository: { columns: { token: true, defaultBranch: true } } },
        })

        try {
          const details = await fetchPullRequestDetails(
            parsed.owner,
            parsed.repo,
            parsed.number,
            parsed.host,
            parsed.isEnterprise,
            task?.repository?.token
          )
          const reviews = await fetchPullRequestReviews(
            parsed.owner,
            parsed.repo,
            parsed.number,
            parsed.host,
            parsed.isEnterprise,
            task?.repository?.token
          )
          const reviewState = determineReviewState(reviews)

          await db.insert(schema.pullRequests).values({
            taskId,
            repositoryId: task?.repositoryId || null,
            githubNumber: details.githubNumber,
            title: details.title,
            url: prUrl,
            status: details.status,
            draft: details.draft,
            reviewState,
            mergeableState: details.mergeableState,
            headBranch: details.headBranch || task?.branchName || null,
            baseBranch: details.baseBranch || task?.repository?.defaultBranch || 'main',
          })
          inserted = true
        } catch (e: any) {
          const hasRepoToken = !!task?.repository?.token
          const tokenSource = hasRepoToken ? 'repository token' : 'no token'
          console.error(
            `[pull-requests.get] Backfill failed for task ${taskId} ` +
            `(auth: ${tokenSource}, repoId: ${task?.repositoryId || 'none'}):`,
            e.message
          )
        }
      }

      if (inserted) {
        try {
          prs = await db.query.pullRequests.findMany({
            where: and(...conditions),
            with: {
              task: {
                columns: { id: true, title: true, assigneeType: true, agentAssigneeId: true, assigneeId: true, branchName: true },
                with: {
                  agentAssignee: { columns: { id: true, name: true, color: true, initials: true } },
                  assignee: { columns: { id: true, name: true } },
                  project: { columns: { id: true, name: true, color: true } },
                },
              },
              repository: { columns: { id: true, name: true, url: true } },
            },
            orderBy: [desc(schema.pullRequests.createdAt)],
          })
        } catch (err: any) {
          console.error('Failed to re-query pull requests after backfill:', err)
        }
      }
    }
  }

  // Filter by search text post-query since we need to match task title or PR title
  let filtered = prs
  if (search) {
    const q = search.toLowerCase()
    filtered = prs.filter(
      (pr) =>
        pr.title.toLowerCase().includes(q) ||
        pr.task?.title?.toLowerCase().includes(q) ||
        pr.task?.branchName?.toLowerCase().includes(q) ||
        false
    )
  }

  return { pullRequests: filtered }
})
