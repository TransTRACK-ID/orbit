import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { createAgentSchema } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, createAgentSchema.parse)
  const db = getDb()

  const initials = body.name
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const [agent] = await db
    .insert(schema.agents)
    .values({
      userId: user.id,
      name: body.name,
      initials,
      role: body.role,
      runtime: body.runtime,
      purpose: body.purpose || null,
      status: body.status || 'idle',
      color: body.color || '#7C3AED',
    })
    .returning()

  return agent
})
