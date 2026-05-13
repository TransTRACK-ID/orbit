import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)

  const db = getDb()

  const pr = await db.query.pullRequests.findFirst({
    where: eq(schema.pullRequests.id, id),
    with: {
      task: {
        columns: {
          id: true,
          title: true,
          description: true,
          assigneeType: true,
          agentAssigneeId: true,
          assigneeId: true,
          branchName: true,
          repositoryId: true,
          statusId: true,
          projectId: true,
        },
        with: {
          agentAssignee: { columns: { id: true, name: true, color: true, initials: true } },
          assignee: { columns: { id: true, name: true } },
          project: { columns: { id: true, name: true, color: true } },
          status: { columns: { id: true, name: true, color: true } },
        },
      },
      repository: { columns: { id: true, name: true, url: true, platform: true, token: true } },
      comments: true,
    },
  })

  if (!pr) throw createError({ statusCode: 404, statusMessage: 'Pull request not found' })

  return { pullRequest: pr }
})
