import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, and, desc, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const query = getQuery(event)
  await requireAuth(event)

  const db = getDb()

  // Get all tasks in this project
  const tasks = await db.query.tasks.findMany({
    where: eq(schema.tasks.projectId, id),
    columns: { id: true },
  })
  const taskIds = tasks.map((t) => t.id)

  const statusFilter = query.status as string | undefined
  const reviewStateFilter = query.reviewState as string | undefined
  const search = query.search as string | undefined

  if (taskIds.length === 0) {
    return { pullRequests: [] }
  }

  const conditions: any[] = [inArray(schema.pullRequests.taskId, taskIds)]

  if (statusFilter) {
    conditions.push(eq(schema.pullRequests.status, statusFilter))
  }
  if (reviewStateFilter) {
    conditions.push(eq(schema.pullRequests.reviewState, reviewStateFilter))
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

  let filtered = prs
  if (search) {
    const q = search.toLowerCase()
    filtered = prs.filter(
      (pr) =>
        pr.title.toLowerCase().includes(q) ||
        pr.task?.title?.toLowerCase().includes(q)
    )
  }

  return { pullRequests: filtered }
})
