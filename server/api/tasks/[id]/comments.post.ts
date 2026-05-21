import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { createCommentSchema } from '~/server/utils/validation'
import { logActivityFeed } from '~/server/utils/activity'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, createCommentSchema.parse)
  const db = getDb()

  const [comment] = await db
    .insert(schema.comments)
    .values({
      taskId: id,
      userId: user.id,
      body: body.body,
    })
    .returning()

  // Log activity
  await db.insert(schema.activityLogs).values({
    taskId: id,
    userId: user.id,
    action: 'comment_added',
  })

  // Log to workspace activity feed
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    with: { project: true },
  })
  if (task?.project) {
    await logActivityFeed({
      workspaceId: task.project.workspaceId,
      userId: user.id,
      action: 'comment_added',
      entityType: 'task',
      entityId: id,
      entityName: task.title,
      message: `commented on task "${task.title}"`,
    })
  }

  // Fetch with user relation
  const created = await db.query.comments.findFirst({
    where: eq(schema.comments.id, comment.id),
    with: {
      user: {
        columns: { id: true, email: true, name: true, avatarUrl: true },
      },
    },
  })

  return created
})
