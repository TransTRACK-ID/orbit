import { listTemplates } from '~/server/utils/project-templates'

export default defineEventHandler(async () => {
  return await listTemplates()
})
