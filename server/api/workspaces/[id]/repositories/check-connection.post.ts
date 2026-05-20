import { requireWorkspaceAccess } from '~/server/utils/auth'
import { checkRepositoryConnectionSchema } from '~/server/utils/validation'
import { githubApiGet, gitlabApiGet } from '~/server/utils/github-api'

function parseGitHubRepoUrl(url: string): { owner: string; repo: string } | null {
  // Match https://github.com/owner/repo.git or https://github.com/owner/repo
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i)
  if (!match) return null
  return { owner: match[1], repo: match[2] }
}

function parseGitLabRepoUrl(url: string): { host: string; projectPath: string } | null {
  // Match https://gitlab.com/group/project.git or https://gitlab.example.com/group/project.git
  // Extract host and path-with-namespace
  const match = url.match(/^(https?:\/\/[^\/]+)\/(.+?)(?:\.git)?$/i)
  if (!match) return null
  const host = match[1]
  const path = match[2]
  // Exclude obvious non-gitlab hosts
  if (host.includes('github.com')) return null
  return { host, projectPath: path }
}

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireWorkspaceAccess(event, id)
  const body = await readValidatedBody(event, checkRepositoryConnectionSchema.parse)

  try {
    if (body.platform === 'github') {
      const parsed = parseGitHubRepoUrl(body.url)
      if (!parsed) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid GitHub repository URL' })
      }
      // Try to fetch repo info — validates URL, token, and repo existence
      await githubApiGet(`/repos/${parsed.owner}/${parsed.repo}`, 'https://github.com', false, body.token)
      return { success: true, message: 'Connection successful' }
    }

    // GitLab or GitLab Self-Hosted
    const parsed = parseGitLabRepoUrl(body.url)
    if (!parsed) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid GitLab repository URL' })
    }
    const encodedPath = encodeURIComponent(parsed.projectPath)
    await gitlabApiGet(`/projects/${encodedPath}`, parsed.host, body.token)
    return { success: true, message: 'Connection successful' }
  } catch (err: any) {
    // Surface a friendly message without leaking internal details
    const message = err.statusMessage || err.message || 'Connection failed'
    throw createError({ statusCode: err.statusCode || 400, statusMessage: message })
  }
})
