import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { createRepositorySchema } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireWorkspaceAccess(event, id)
  const body = await readValidatedBody(event, createRepositorySchema.parse)
  const db = getDb()

  const [repository] = await db
    .insert(schema.repositories)
    .values({
      workspaceId: id,
      name: body.name,
      url: body.url,
      defaultBranch: body.defaultBranch || 'main',
      createBranch: body.createBranch ?? true,
    })
    .returning()

  return repository
})
