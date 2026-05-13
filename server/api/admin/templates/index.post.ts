import { requireSuperAdmin } from '~/server/utils/auth'
import { getTemplates, saveTemplates, type TemplateConfig } from '~/server/utils/project-templates'
import { z } from 'zod'

const createTemplateSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string(),
  category: z.string(),
  stack: z.string(),
  sourceType: z.enum(['local_path', 'git', 'npx', 'command']),
  sourcePath: z.string().min(1),
  branch: z.string().optional(),
  variables: z.array(z.object({
    key: z.string(),
    label: z.string(),
    required: z.boolean(),
    default: z.string().optional(),
    autoGenerate: z.boolean().optional(),
    length: z.number().optional(),
  })).default([]),
  fileSubstitutions: z.array(z.object({
    path: z.string(),
    replacements: z.record(z.string()),
  })).default([]),
  renameFiles: z.array(z.object({
    from: z.string(),
    to: z.string(),
  })).optional(),
  postInitCommands: z.array(z.object({
    command: z.string(),
    timeout: z.number().optional(),
    description: z.string(),
  })).default([]),
  gitInit: z.boolean().default(true),
  initialCommitMessage: z.string().default('chore: initialize from template'),
})

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const body = await readValidatedBody(event, createTemplateSchema.parse)

  const templates = await getTemplates()

  if (templates.some(t => t.id === body.id)) {
    throw createError({ statusCode: 409, statusMessage: 'Template ID already exists' })
  }

  const newTemplate: TemplateConfig = {
    id: body.id,
    name: body.name,
    description: body.description,
    category: body.category,
    stack: body.stack,
    sourceType: body.sourceType,
    sourcePath: body.sourcePath,
    branch: body.branch,
    variables: body.variables,
    fileSubstitutions: body.fileSubstitutions,
    renameFiles: body.renameFiles || [],
    postInitCommands: body.postInitCommands,
    gitInit: body.gitInit,
    initialCommitMessage: body.initialCommitMessage,
  }

  templates.push(newTemplate)
  await saveTemplates(templates)

  return { template: newTemplate }
})
