import { getDb, schema } from '~/server/database'

export async function logActivityFeed(opts: {
  workspaceId: string
  userId: string
  action: string
  entityType: string
  entityId?: string | null
  entityName?: string | null
  message: string
  oldValue?: any
  newValue?: any
}) {
  const db = getDb()
  await db.insert(schema.activityFeed).values({
    workspaceId: opts.workspaceId,
    userId: opts.userId,
    action: opts.action,
    entityType: opts.entityType,
    entityId: opts.entityId || null,
    entityName: opts.entityName || null,
    message: opts.message,
    oldValue: opts.oldValue || null,
    newValue: opts.newValue || null,
  })
}
