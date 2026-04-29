import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { updateProjectSchema } from '~/server/utils/validation'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireProjectAccess(event, id)
  const body = await readValidatedBody(event, updateProjectSchema.parse)
  const db = getDb()

  const [updated] = await db
    .update(schema.projects)
    .set(body)
    .where(eq(schema.projects.id, id))
    .returning()

  return updated
})
