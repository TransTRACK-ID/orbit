import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'

export default defineEventHandler(async (event) => {
  const { id: workspaceId } = getRouterParams(event)
  const { user } = await requireWorkspaceAccess(event, workspaceId)
  const body = await readBody(event)

  const db = getDb()
  const [entry] = await db.insert(schema.activityFeed)
    .values({
      workspaceId,
      userId: user.id,
      entityType: body.entityType || 'general',
      entityId: (body.entityId || '').slice(0, 255) || null,
      entityName: (body.entityName || '').slice(0, 255) || null,
      action: body.action || 'update',
      message: body.message || '',
      oldValue: body.oldValue || null,
      newValue: body.newValue || null,
    })
    .returning()

  return entry
})
