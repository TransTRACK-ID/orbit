import { requireSuperAdmin } from '~/server/utils/auth'
import { updateAppSettings } from '~/server/utils/app-settings'
import { z } from 'zod'

const bodySchema = z.object({
  loginRequired: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' })
  }

  const updated = await updateAppSettings(parsed.data)
  return updated
})
