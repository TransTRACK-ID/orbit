import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { enrichBrainstorm } from '~/server/utils/grill-mode'
import { eq, desc, sql, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)
  const db = getDb()

  // Verify workspace membership
  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(schema.workspaceMembers.workspaceId, id),
  })
  if (!membership || membership.userId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const brainstorms = await db.query.brainstorms.findMany({
    where: eq(schema.brainstorms.workspaceId, id),
    orderBy: [desc(schema.brainstorms.createdAt)],
    with: {
      repository: true,
    },
  })

  // Count PRDs per brainstorm
  const prdCounts = await db
    .select({
      brainstormId: schema.prds.brainstormId,
      count: sql<number>`count(${schema.prds.id})`.as('count'),
    })
    .from(schema.prds)
    .where(inArray(schema.prds.brainstormId, brainstorms.map(b => b.id)))
    .groupBy(schema.prds.brainstormId)

  const countMap = new Map(prdCounts.map(c => [c.brainstormId, c.count]))

  const enrichedBrainstorms = brainstorms.map(bs => enrichBrainstorm({
    ...bs,
    _prdCount: countMap.get(bs.id) || 0,
  }))

  return enrichedBrainstorms
})
