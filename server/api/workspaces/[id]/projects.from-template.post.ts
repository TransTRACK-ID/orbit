import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { createProjectFromTemplateSchema } from '~/server/utils/validation'
import { initializeFromTemplate, getTemplateById } from '~/server/utils/project-templates'
import { createGitHubRepo, createGitLabRepo } from '~/server/utils/github-api'

const DEFAULT_STATUSES = [
  { name: 'Backlog', color: '#94a3b8', position: 0, isDefault: true },
  { name: 'Todo', color: '#3b82f6', position: 1, isDefault: false },
  { name: 'In Progress', color: '#f59e0b', position: 2, isDefault: false },
  { name: 'Review', color: '#8b5cf6', position: 3, isDefault: false },
  { name: 'Done', color: '#22c55e', position: 4, isDefault: false },
]

export default defineEventHandler(async (event) => {
  const { id: workspaceId } = getRouterParams(event)
  const { user } = await requireWorkspaceAccess(event, workspaceId)
  const body = await readValidatedBody(event, createProjectFromTemplateSchema.parse)
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
  const { targetDir } = await initializeFromTemplate(
    body.templateId,
    body.name,
    body.repositoryName,
    body.variables,
    remoteUrl,
    body.token,
    body.platform
  )

  // ─── 3. Create project record ───
  const [project] = await db.insert(schema.projects).values({
    workspaceId,
    name: body.name,
    description: body.description || null,
    color: body.color || '#F14848',
    icon: body.icon || null,
    templateId: template.id,
    stack: template.stack,
  }).returning()

  await db.insert(schema.projectMembers).values({
    projectId: project.id,
    userId: user.id,
    role: 'owner',
  })

  await db.insert(schema.statuses).values(
    DEFAULT_STATUSES.map(s => ({ projectId: project.id, ...s }))
  )

  // ─── 4. Create repository record (always, even for local-only) ───
  const [repository] = await db.insert(schema.repositories).values({
    workspaceId,
    name: body.repositoryName,
    url: remoteUrl || '',
    defaultBranch: template.branch || 'main',
    createBranch: true,
    platform: body.platform,
    token: body.token || null,
  }).returning()

  // ─── 5. Link repository to project ───
  await db.update(schema.projects)
    .set({ repositoryId: repository.id })
    .where(eq(schema.projects.id, project.id))
  project.repositoryId = repository.id

  return { project, repositoryUrl: remoteUrl, targetDir }
})
