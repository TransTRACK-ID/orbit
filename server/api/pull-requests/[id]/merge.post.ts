import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { parseGithubUrl, parseGitlabUrl, githubApiGet, gitlabApiGet } from '~/server/utils/github-api'

type MergeMethod = 'merge' | 'squash' | 'rebase'

// ─── GitHub merge ────────────────────────────────────────────────────────────

async function mergeGitHubPR(
  owner: string, repo: string, number: number,
  host: string, isEnterprise: boolean, token: string | undefined,
  method: MergeMethod, commitMessage?: string
) {
  const base = isEnterprise ? `${host}/api/v3` : 'https://api.github.com'
  const url = `${base}/repos/${owner}/${repo}/pulls/${number}/merge`

  const body: Record<string, string> = {
    merge_method: method, // 'merge' | 'squash' | 'rebase'
  }
  if (commitMessage) body.commit_message = commitMessage

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'orbit-app',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) })

  if (res.status === 200 || res.status === 201) {
    const data = await res.json() as { merged: boolean; message: string; sha: string }
    return { merged: data.merged, sha: data.sha, message: data.message }
  }

  const text = await res.text().catch(() => '')
  let message = `GitHub API ${res.status}`
  try {
    const parsed = JSON.parse(text)
    if (parsed.message) message = parsed.message
  } catch { message += `: ${text.slice(0, 300)}` }

  throw createError({ statusCode: res.status === 405 ? 405 : 422, statusMessage: message })
}

// ─── GitLab merge ────────────────────────────────────────────────────────────

async function mergeGitLabMR(
  projectPath: string, iid: number,
  host: string, token: string | undefined,
  method: MergeMethod, commitMessage?: string
) {
  const encodedPath = encodeURIComponent(projectPath)
  const url = `${host}/api/v4/projects/${encodedPath}/merge_requests/${iid}/merge`

  // GitLab merge strategies: squash param + merge_commit_message
  const body: Record<string, string | boolean> = {}
  if (method === 'squash') {
    body.squash = true
    if (commitMessage) body.squash_commit_message = commitMessage
  } else {
    body.squash = false
    if (commitMessage) body.merge_commit_message = commitMessage
  }
  // GitLab doesn't have a native rebase-then-merge via API the same way;
  // rebase falls back to merge commit for GitLab
  if (method === 'rebase') body.squash = false

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'orbit-app',
  }
  if (token) headers['PRIVATE-TOKEN'] = token

  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) })

  if (res.status === 200 || res.status === 201) {
    const data = await res.json() as { state: string; merge_commit_sha: string; title: string }
    return { merged: data.state === 'merged', sha: data.merge_commit_sha, message: data.title }
  }

  const text = await res.text().catch(() => '')
  let message = `GitLab API ${res.status}`
  try {
    const parsed = JSON.parse(text)
    if (parsed.message) message = Array.isArray(parsed.message) ? parsed.message.join(', ') : String(parsed.message)
  } catch { message += `: ${text.slice(0, 300)}` }

  throw createError({ statusCode: 422, statusMessage: message })
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)

  const body = await readBody(event).catch(() => ({})) as {
    method?: MergeMethod
    commitMessage?: string
  }
  const mergeMethod: MergeMethod = body.method ?? 'merge'

  const db = getDb()

  const pr = await db.query.pullRequests.findFirst({
    where: eq(schema.pullRequests.id, id),
    with: { repository: { columns: { url: true, token: true, name: true } } },
  })

  if (!pr) throw createError({ statusCode: 404, statusMessage: 'Pull request not found' })

  if (pr.status === 'merged') {
    throw createError({ statusCode: 409, statusMessage: 'Pull request is already merged' })
  }
  if (pr.status === 'closed') {
    throw createError({ statusCode: 409, statusMessage: 'Pull request is closed and cannot be merged' })
  }

  const gh = parseGithubUrl(pr.url)
  const gl = !gh ? parseGitlabUrl(pr.url) : null

  if (!gh && !gl) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot determine provider from PR URL' })
  }

  try {
    let result: { merged: boolean; sha: string; message: string }

    if (gh) {
      result = await mergeGitHubPR(
        gh.owner, gh.repo, gh.number,
        gh.host, gh.isEnterprise,
        pr.repository?.token,
        mergeMethod,
        body.commitMessage
      )
    } else {
      result = await mergeGitLabMR(
        gl!.projectPath, gl!.iid,
        gl!.host,
        pr.repository?.token,
        mergeMethod,
        body.commitMessage
      )
    }

    if (!result.merged && result.sha) {
      // Some providers return 200 with merged=false on race; treat sha presence as success
      result.merged = true
    }

    // Update PR status in database
    await db.update(schema.pullRequests)
      .set({
        status: 'merged',
        mergeableState: null,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.pullRequests.id, id))

    return {
      merged: result.merged,
      sha: result.sha,
      message: result.message,
      pullRequestId: id,
    }
  } catch (err: any) {
    // Re-throw H3 errors as-is, wrap others
    if (err.statusCode) throw err
    throw createError({
      statusCode: 422,
      statusMessage: err.message || 'Merge failed',
    })
  }
})
