import { and, eq, ilike } from 'drizzle-orm'
import { getDb, schema } from '~/server/database'

type Db = ReturnType<typeof getDb>

const ORBIT_STATUS_RE = /\[ORBIT_STATUS:\s*([a-zA-Z_\- ]+)\s*\]/gi

export function extractOrbitStatusNames(text: string): string[] {
  if (!text?.trim()) return []
  const names: string[] = []
  let match: RegExpExecArray | null
  ORBIT_STATUS_RE.lastIndex = 0
  while ((match = ORBIT_STATUS_RE.exec(text)) !== null) {
    const name = match[1]?.trim()
    if (name) names.push(name)
  }
  return names
}

/** Apply the last [ORBIT_STATUS: …] marker found in agent output. */
export async function applyOrbitStatusFromAgentText(
  db: Db,
  opts: {
    taskId: string
    projectId: string
    currentStatusId: string
    userId: string
    text: string
  },
): Promise<{ applied: boolean; statusName?: string }> {
  const names = extractOrbitStatusNames(opts.text)
  if (names.length === 0) return { applied: false }

  const desiredStatus = names[names.length - 1].toLowerCase()

  let targetStatus = await db.query.statuses.findFirst({
    where: and(
      eq(schema.statuses.projectId, opts.projectId),
      ilike(schema.statuses.name, desiredStatus),
    ),
  })
  if (!targetStatus) {
    targetStatus = await db.query.statuses.findFirst({
      where: and(
        eq(schema.statuses.projectId, opts.projectId),
        ilike(schema.statuses.name, `%${desiredStatus}%`),
      ),
    })
  }
  if (!targetStatus || targetStatus.id === opts.currentStatusId) {
    return { applied: false, statusName: targetStatus?.name }
  }

  const oldStatus = await db.query.statuses.findFirst({
    where: eq(schema.statuses.id, opts.currentStatusId),
  })

  await db.update(schema.tasks)
    .set({ statusId: targetStatus.id })
    .where(eq(schema.tasks.id, opts.taskId))

  await db.insert(schema.activityLogs).values({
    taskId: opts.taskId,
    userId: opts.userId,
    action: 'status_change',
    oldValue: { statusId: opts.currentStatusId, statusName: oldStatus?.name },
    newValue: { statusId: targetStatus.id, statusName: targetStatus.name },
  })

  return { applied: true, statusName: targetStatus.name }
}
