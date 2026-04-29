import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

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

  return project
})
