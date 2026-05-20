import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, and, isNotNull, desc } from 'drizzle-orm'
import { createReadStream, existsSync } from 'fs'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { id } = getRouterParams(event)

  const db = getDb()

  // Fetch task with project for access check
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    with: {
      project: { with: { workspace: true } },
    },
  })

  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  // Verify workspace membership
  const member = await db.query.workspaceMembers.findFirst({
    where: (wm, { and, eq }) =>
      and(eq(wm.workspaceId, task.project.workspaceId), eq(wm.userId, user.id)),
  })

  if (!member) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  // Optionally serve a specific session's screenshot via ?session= query param.
  // When omitted, fall back to the latest session (existing behaviour).
  const query = getQuery(event) as { session?: string }
  let session: typeof schema.browserSessions.$inferSelect | undefined

  if (query.session) {
    session = await db.query.browserSessions.findFirst({
      where: and(
        eq(schema.browserSessions.id, query.session),
        eq(schema.browserSessions.taskId, id),
        isNotNull(schema.browserSessions.screenshotPath)
      ),
    })
  }

  if (!session) {
    session = await db.query.browserSessions.findFirst({
      where: and(
        eq(schema.browserSessions.taskId, id),
        isNotNull(schema.browserSessions.screenshotPath)
      ),
      orderBy: desc(schema.browserSessions.createdAt),
    })
  }

  if (!session || !session.screenshotPath || !existsSync(session.screenshotPath)) {
    throw createError({ statusCode: 404, statusMessage: 'Screenshot not found' })
  }

  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=300')

  return sendStream(event, createReadStream(session.screenshotPath))
})
