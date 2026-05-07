import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireWorkspaceAccess(event, id)
  const db = getDb()

  return await db.query.repositories.findMany({
    where: eq(schema.repositories.workspaceId, id),
    orderBy: (repos, { asc }) => [asc(repos.createdAt)],
  })
})
