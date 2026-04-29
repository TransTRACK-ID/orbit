import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireWorkspaceAccess(event, id)
  const db = getDb()

  const projectsList = await db.query.projects.findMany({
    where: eq(schema.projects.workspaceId, id),
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  })

  return projectsList
})
