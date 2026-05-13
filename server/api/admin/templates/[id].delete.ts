import { requireSuperAdmin } from '~/server/utils/auth'
import { getTemplates, saveTemplates } from '~/server/utils/project-templates'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const { id } = getRouterParams(event)

  const templates = await getTemplates()
  const filtered = templates.filter(t => t.id !== id)

  if (filtered.length === templates.length) {
    throw createError({ statusCode: 404, statusMessage: 'Template not found' })
  }

  await saveTemplates(filtered)

  return { success: true }
})
