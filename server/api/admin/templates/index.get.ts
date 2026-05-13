import { requireSuperAdmin } from '~/server/utils/auth'
import { getTemplates, saveTemplates, type TemplateConfig } from '~/server/utils/project-templates'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const templates = await getTemplates()
  return { templates }
})
