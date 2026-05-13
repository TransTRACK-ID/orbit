import { requireSuperAdmin } from '~/server/utils/auth'
import { getTemplates, saveTemplates, type TemplateConfig } from '~/server/utils/project-templates'
import { z } from 'zod'

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  stack: z.string().optional(),
  sourceType: z.enum(['local_path', 'git', 'npx', 'command']).optional(),
  sourcePath: z.string().min(1).optional(),
  branch: z.string().optional(),
  variables: z.array(z.object({
    key: z.string(),
    label: z.string(),
    required: z.boolean(),
    default: z.string().optional(),
    autoGenerate: z.boolean().optional(),
    length: z.number().optional(),
  })).optional(),
  fileSubstitutions: z.array(z.object({
    path: z.string(),
    replacements: z.record(z.string()),
  })).optional(),
  renameFiles: z.array(z.object({
    from: z.string(),
    to: z.string(),
  })).optional(),
  postInitCommands: z.array(z.object({
    command: z.string(),
    timeout: z.number().optional(),
    description: z.string(),
  })).optional(),
  gitInit: z.boolean().optional(),
  initialCommitMessage: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const { id } = getRouterParams(event)
  const body = await readValidatedBody(event, updateTemplateSchema.parse)

  const templates = await getTemplates()
  const index = templates.findIndex(t => t.id === id)

  if (index === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Template not found' })
  }

  const updated: TemplateConfig = {
    ...templates[index],
    ...body,
  }

  templates[index] = updated
  await saveTemplates(templates)

  return { template: updated }
})
