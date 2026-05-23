import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export async function appendPreviewLog(instanceId: string, line: string): Promise<void> {
  const db = getDb()
  const instance = await db.query.previewInstances.findFirst({
    where: eq(schema.previewInstances.id, instanceId),
  })

  if (!instance) return

  const logs = [...(instance.logs || []), line].slice(-500)

  await db.update(schema.previewInstances)
    .set({ logs })
    .where(eq(schema.previewInstances.id, instanceId))
}
