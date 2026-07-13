import { and, eq, ilike } from 'drizzle-orm'
import { getDb, schema } from '~/server/database'

type Db = ReturnType<typeof getDb>

/** Move an in-progress agent task to Review (loop-limit fallback — not normal completion). */
export async function advanceAgentTaskToReview(
  db: Db,
  opts: { taskId: string; projectId: string; currentStatusId: string; userId: string },
): Promise<{ advanced: boolean; statusId?: string; statusName?: string }> {
  const currentStatus = await db.query.statuses.findFirst({
    where: eq(schema.statuses.id, opts.currentStatusId),
  })
  if (!currentStatus) return { advanced: false }

  if (/review/i.test(currentStatus.name) || /done/i.test(currentStatus.name)) {
    return { advanced: false }
  }

  if (!/progress/i.test(currentStatus.name)) {
    return { advanced: false }
  }

  const reviewStatus = await db.query.statuses.findFirst({
    where: and(
      eq(schema.statuses.projectId, opts.projectId),
      ilike(schema.statuses.name, '%review%'),
    ),
  })
  if (!reviewStatus || reviewStatus.id === opts.currentStatusId) {
    return { advanced: false }
  }

  await db.update(schema.tasks)
    .set({ statusId: reviewStatus.id })
    .where(eq(schema.tasks.id, opts.taskId))

  await db.insert(schema.activityLogs).values({
    taskId: opts.taskId,
    userId: opts.userId,
    action: 'status_change',
    oldValue: { statusId: opts.currentStatusId, statusName: currentStatus.name },
    newValue: { statusId: reviewStatus.id, statusName: reviewStatus.name },
  })

  return { advanced: true, statusId: reviewStatus.id, statusName: reviewStatus.name }
}
