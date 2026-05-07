import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, and, gte, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireProjectAccess(event, id)
  const db = getDb()

  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, id),
    with: {
      statuses: {
        orderBy: (s, { asc }) => [asc(s.position)],
      },
      labels: true,
    },
  })

  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  // Auto-create "Review" status for existing projects that don't have it
  let mutated = false
  const reviewStatus = project.statuses.find((s) => /review/i.test(s.name))
  const doneStatus = project.statuses.find((s) => /done/i.test(s.name))

  if (!reviewStatus) {
    mutated = true
    const insertPos = doneStatus ? doneStatus.position : project.statuses.length

    // Shift up all statuses at or after the insert position
    await db.update(schema.statuses)
      .set({ position: sql`position + 1` })
      .where(
        and(
          eq(schema.statuses.projectId, project.id),
          gte(schema.statuses.position, insertPos)
        )
      )

    await db.insert(schema.statuses).values({
      projectId: project.id,
      name: 'Review',
      color: '#8b5cf6',
      position: insertPos,
      isDefault: false,
    })
  } else if (doneStatus && reviewStatus.position > doneStatus.position) {
    // Review exists but is after Done — swap their positions so Review comes before Done
    mutated = true
    await db.update(schema.statuses)
      .set({ position: doneStatus.position })
      .where(eq(schema.statuses.id, reviewStatus.id))

    await db.update(schema.statuses)
      .set({ position: reviewStatus.position })
      .where(eq(schema.statuses.id, doneStatus.id))
  }

  if (mutated) {
    const refreshed = await db.query.projects.findFirst({
      where: eq(schema.projects.id, id),
      with: {
        statuses: {
          orderBy: (s, { asc }) => [asc(s.position)],
        },
        labels: true,
      },
    })
    return refreshed
  }

  return project
})
