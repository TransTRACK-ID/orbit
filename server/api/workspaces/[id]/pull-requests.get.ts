import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, and, or, like, desc, inArray } from 'drizzle-orm'

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
  const assigneeFilter = query.assigneeType as string | undefined

  const conditions: any[] = [
    or(
      inArray(schema.pullRequests.repositoryId, repoIds),
      inArray(schema.pullRequests.taskId, taskIds)
    )!,
  ]

  if (statusFilter) {
    conditions.push(eq(schema.pullRequests.status, statusFilter))
  }
  if (reviewStateFilter) {
    conditions.push(eq(schema.pullRequests.reviewState, reviewStateFilter))
  }
  if (repoFilter) {
    conditions.push(eq(schema.pullRequests.repositoryId, repoFilter))
  }
  if (assigneeFilter) {
    if (assigneeFilter === 'agent') {
      conditions.push(eq(schema.tasks.assigneeType, 'agent'))
    } else if (assigneeFilter === 'user') {
      conditions.push(eq(schema.tasks.assigneeType, 'user'))
    }
  }

  const prs = await db.query.pullRequests.findMany({
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
