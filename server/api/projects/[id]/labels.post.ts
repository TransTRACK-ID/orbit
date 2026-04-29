import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { createLabelSchema } from '~/server/utils/validation'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireProjectAccess(event, id)
  const body = await readValidatedBody(event, createLabelSchema.parse)
  const db = getDb()

  const [label] = await db
    .insert(schema.labels)
    .values({
      projectId: id,
      name: body.name,
      color: body.color || '#3b82f6',
    })
    .returning()

  return label
})
