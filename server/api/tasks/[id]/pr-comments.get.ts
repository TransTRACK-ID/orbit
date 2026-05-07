import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, desc, and } from 'drizzle-orm'

function parsePrUrl(url: string): { owner: string; repo: string; number: number } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(\/pull|\/issues)\/(\d+)/i)
  if (!match) return null
  return { owner: match[1], repo: match[2].replace(/\.git$/, ''), number: parseInt(match[4], 10) }
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

async function apiGet(path: string) {
  const url = `https://api.github.com${path}`
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'orbit-app' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const query = getQuery(event)
  await requireAuth(event)

  const db = getDb()
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    columns: { id: true },
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
      // Return all cached comments for this task
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

  // Fetch from GitHub API
  const parsed = parsePrUrl(prUrl)
  if (!parsed) return { comments: [] }

  const { owner, repo, number } = parsed
  const comments: PrComment[] = []
  const errors: string[] = []

  try {
    const reviewData: any[] = await apiGet(`/repos/${owner}/${repo}/pulls/${number}/comments`)
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
    const issueData: any[] = await apiGet(`/repos/${owner}/${repo}/issues/${number}/comments`)
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
    const reviewsData: any[] = await apiGet(`/repos/${owner}/${repo}/pulls/${number}/reviews`)
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

  comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  // Persist comments to DB
  if (comments.length > 0) {
    // Delete existing cached comments for this task before re-saving
    await db.delete(schema.prComments).where(eq(schema.prComments.taskId, id))

    const now = new Date().toISOString()
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
        syncedAt: now as any,
      }))
    )
  }

  return { comments, prUrl, errors: errors.length > 0 ? errors : undefined, cached: false }
})
