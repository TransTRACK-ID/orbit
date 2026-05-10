import { exec } from 'child_process'
import { promisify } from 'util'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, desc } from 'drizzle-orm'

const execAsync = promisify(exec)

function parseGitlabUrl(url: string): { host: string; projectPath: string; iid: number } | null {
  // Self-hosted GitLab: https://my-gitlab.example.com/owner/repo/-/merge_requests/123
  const match = url.match(/^(https?:\/\/[^\/]+)\/(.+?)\/\-\/merge_requests\/(\d+)/i)
  if (match) return { host: match[1], projectPath: match[2], iid: parseInt(match[3], 10) }
  return null
}

function parseGithubUrl(url: string): { host: string; owner: string; repo: string; number: number; isEnterprise: boolean } | null {
  // Self-hosted GitHub Enterprise: https://my-github.example.com/owner/repo/pull/123
  const enterpriseMatch = url.match(/^(https?:\/\/[^\/]+)\/([^/]+)\/([^/]+?)(\/pull|\/issues)\/(\d+)/i)
  if (enterpriseMatch) {
    const host = enterpriseMatch[1]
    if (!host.includes('github.com')) {
      return { host, owner: enterpriseMatch[2], repo: enterpriseMatch[3].replace(/\.git$/, ''), number: parseInt(enterpriseMatch[5], 10), isEnterprise: true }
    }
  }
  // Public GitHub: https://github.com/owner/repo/pull/123
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(\/pull|\/issues)\/(\d+)/i)
  if (!match) return null
  return { host: 'https://github.com', owner: match[1], repo: match[2].replace(/\.git$/, ''), number: parseInt(match[4], 10), isEnterprise: false }
}



export interface PrComment {
  id: number
  author: string
  body: string
  path: string | null
  line: number | null
  createdAt: string
  isReview: boolean
}

async function githubApiGet(path: string, host: string, isEnterprise: boolean) {
  const base = isEnterprise ? `${host}/api/v3` : 'https://api.github.com'
  const url = `${base}${path}`
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'orbit-app',
  }
  const token = process.env.GITHUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

async function gitlabApiGet(projectPath: string, iid: number, gitlabHost: string, token?: string): Promise<any[]> {
  const encodedPath = encodeURIComponent(projectPath)
  const host = gitlabHost || 'https://gitlab.com'
  // Prefer direct HTTP API with the repository token
  const url = `${host}/api/v4/projects/${encodedPath}/merge_requests/${iid}/discussions`
  const headers: Record<string, string> = { 'User-Agent': 'orbit-app', 'Content-Type': 'application/json' }
  if (token) headers['PRIVATE-TOKEN'] = token
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

async function fetchGithubComments(owner: string, repo: string, number: number, host: string, isEnterprise: boolean): Promise<{ comments: PrComment[]; errors: string[] }> {
  const comments: PrComment[] = []
  const errors: string[] = []

  try {
    const reviewData: any[] = await githubApiGet(`/repos/${owner}/${repo}/pulls/${number}/comments`, host, isEnterprise)
    for (const c of reviewData) {
      comments.push({
        id: c.id,
        author: c.user?.login || 'unknown',
        body: c.body || '',
        path: c.path || null,
        line: c.line || null,
        createdAt: c.created_at || '',
        isReview: true,
      })
    }
  } catch (e: any) { errors.push(`review: ${e.message}`) }

  try {
    const issueData: any[] = await githubApiGet(`/repos/${owner}/${repo}/issues/${number}/comments`, host, isEnterprise)
    for (const c of issueData) {
      if (!comments.some(ex => ex.body === c.body && ex.author === (c.user?.login || 'unknown'))) {
        comments.push({
          id: c.id,
          author: c.user?.login || 'unknown',
          body: c.body || '',
          path: null,
          line: null,
          createdAt: c.created_at || '',
          isReview: false,
        })
      }
    }
  } catch (e: any) { errors.push(`issue: ${e.message}`) }

  try {
    const reviewsData: any[] = await githubApiGet(`/repos/${owner}/${repo}/pulls/${number}/reviews`, host, isEnterprise)
    for (const r of reviewsData) {
      if (!r.body) continue
      if (comments.some(ex => ex.body === r.body && ex.author === (r.user?.login || 'unknown'))) continue
      comments.push({
        id: r.id,
        author: r.user?.login || 'unknown',
        body: r.body,
        path: null,
        line: null,
        createdAt: r.submitted_at || '',
        isReview: true,
      })
    }
  } catch (e: any) { errors.push(`reviews: ${e.message}`) }

  return { comments, errors }
}

async function fetchGitlabComments(projectPath: string, iid: number, gitlabHost: string, token?: string): Promise<{ comments: PrComment[]; errors: string[] }> {
  const comments: PrComment[] = []
  const errors: string[] = []

  try {
    const discussions: any[] = await gitlabApiGet(projectPath, iid, gitlabHost, token)
    for (const d of discussions) {
      for (const note of (d.notes || [])) {
        if (note.system) continue
        comments.push({
          id: note.id,
          author: note.author?.name || note.author?.username || 'unknown',
          body: note.body || '',
          path: note.position?.new_path || null,
          line: note.position?.new_line || null,
          createdAt: note.created_at || '',
          isReview: !!note.position,
        })
      }
    }
  } catch (e: any) { errors.push(`gitlab: ${e.message}`) }

  return { comments, errors }
}

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const query = getQuery(event)
  await requireAuth(event)

  const db = getDb()
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    columns: { id: true, repositoryId: true },
    with: {
      repository: {
        columns: { id: true, url: true, platform: true, token: true },
      },
    },
  })
  if (!task) throw createError({ statusCode: 404, statusMessage: 'Task not found' })

  let prUrl = query.prUrl as string || ''
  const refresh = query.refresh === 'true'

  if (!prUrl) {
    const prLogs = await db.query.activityLogs.findMany({
      where: eq(schema.activityLogs.taskId, id),
      columns: { action: true, newValue: true },
      orderBy: [desc(schema.activityLogs.createdAt)],
      limit: 50,
    })
    for (const log of prLogs) {
      if ((log.action === 'pr_created' || log.action === 'pr_updated') && log.newValue?.url) {
        prUrl = log.newValue.url
        break
      }
    }
  }
  if (!prUrl) return { comments: [] }

  // Check for cached comments in DB (unless refresh is requested)
  if (!refresh) {
    const cachedComments = await db.query.prComments.findMany({
      where: eq(schema.prComments.taskId, id),
      orderBy: [desc(schema.prComments.syncedAt)],
      limit: 1,
    })
    if (cachedComments.length > 0) {
      const allCached = await db.query.prComments.findMany({
        where: eq(schema.prComments.taskId, id),
        orderBy: [desc(schema.prComments.githubCommentId)],
      })
      return {
        comments: allCached.map(c => ({
          id: c.githubCommentId,
          author: c.author,
          body: c.body,
          path: c.path,
          line: c.line,
          createdAt: c.createdAt || '',
          isReview: c.isReview,
        })),
        prUrl,
        cached: true,
      }
    }
  }

  let comments: PrComment[] = []
  let errors: string[] = []

  // Detect platform from URL
  const ghParsed = parseGithubUrl(prUrl)
  const glParsed = parseGitlabUrl(prUrl)

  if (ghParsed) {
    const result = await fetchGithubComments(ghParsed.owner, ghParsed.repo, ghParsed.number, ghParsed.host, ghParsed.isEnterprise)
    comments = result.comments
    errors = result.errors
  } else if (glParsed) {
    const repoToken = task.repository?.token
    if (!repoToken) {
      return {
        comments: [],
        prUrl,
        errors: ['Missing repository access token. Add a GitLab Personal Access Token in Workspace Settings → Repositories.'],
        needsAuth: true,
        cached: false,
      }
    }
    const result = await fetchGitlabComments(glParsed.projectPath, glParsed.iid, glParsed.host, repoToken)
    comments = result.comments
    errors = result.errors
  } else {
    return { comments: [] }
  }

  comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  // Persist comments to DB
  if (comments.length > 0) {
    await db.delete(schema.prComments).where(eq(schema.prComments.taskId, id))
    await db.insert(schema.prComments).values(
      comments.map(c => ({
        taskId: id,
        githubCommentId: c.id,
        author: c.author,
        body: c.body,
        path: c.path,
        line: c.line,
        isReview: c.isReview,
        createdAt: c.createdAt,
      }))
    )
  }

  return { comments, prUrl, errors: errors.length > 0 ? errors : undefined, cached: false }
})
