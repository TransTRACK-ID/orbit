import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { updateAgentSchema } from '~/server/utils/validation'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, updateAgentSchema.parse)
  const db = getDb()

  const existing = await db.query.agents.findFirst({
    where: eq(schema.agents.id, id),
  })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
  }

  if (existing.userId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const updateData: any = { ...body }

  if (body.name) {
    updateData.initials = body.name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }

  const [updated] = await db
    .update(schema.agents)
    .set(updateData)
    .where(eq(schema.agents.id, id))
    .returning()

  return updated
})
