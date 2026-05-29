import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { createRepositoryFromTemplateSchema } from '~/server/utils/validation'
import { initializeFromTemplate, getTemplateById } from '~/server/utils/project-templates'
import { createGitHubRepo, createGitLabRepo } from '~/server/utils/github-api'

export default defineEventHandler(async (event) => {
  const { id: workspaceId } = getRouterParams(event)
  await requireWorkspaceAccess(event, workspaceId)
  const body = await readValidatedBody(event, createRepositoryFromTemplateSchema.parse)
  const db = getDb()

  const template = await getTemplateById(body.templateId)
  if (!template) throw createError({ statusCode: 400, message: 'Template not found' })

  // ─── 1. Create remote repo (if requested) ───
  let remoteUrl = body.repositoryUrl
  if (body.createRemoteRepo && !remoteUrl) {
    if (!body.token) {
      throw createError({ statusCode: 400, message: 'Access token is required to create a remote repository.' })
    }
    if (body.platform === 'github') {
      remoteUrl = await createGitHubRepo(body.token, body.repositoryName, body.isPrivate, body.description)
    } else if (body.platform === 'gitlab' || body.platform === 'gitlab-self-hosted') {
      const host = body.gitlabHost || 'https://gitlab.com'
      remoteUrl = await createGitLabRepo(body.token, body.repositoryName, body.isPrivate, body.description, host)
    } else {
      throw createError({ statusCode: 400, message: 'Auto-create not supported for this platform. Provide a repositoryUrl.' })
    }
  }

  // ─── 2. Initialize from template ───
  await initializeFromTemplate(
    body.templateId,
    body.name,
    body.repositoryName,
    body.variables,
    remoteUrl,
    body.token,
    body.platform
  )

  // ─── 3. Create repository record ───
  const [repository] = await db.insert(schema.repositories).values({
    workspaceId,
    name: body.repositoryName,
    url: remoteUrl || '',
    defaultBranch: template.branch || 'main',
    createBranch: true,
    platform: body.platform,
    token: body.token || null,
  }).returning()

  return { repository, repositoryUrl: remoteUrl }
})
