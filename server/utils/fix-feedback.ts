import { getDb, schema } from '~/server/database'
import { eq, desc } from 'drizzle-orm'
import { pendingFeedback } from '~/server/utils/runtime'
import { parseGithubUrl, fetchPullRequestComments, fetchIssueComments, determineReviewState, fetchPullRequestReviews } from '~/server/utils/github-api'

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export interface FixFeedbackResult {
  success: true
  taskId: string
  commentCount: number
  feedbackLength: number
  pullRequestId: string
}

export async function executeFixFeedback(prId: string, userId: string): Promise<FixFeedbackResult> {
  const db = getDb()

  const pr = await db.query.pullRequests.findFirst({
    where: eq(schema.pullRequests.id, prId),
    with: {
      task: { columns: { id: true, title: true, repositoryId: true } },
      repository: { columns: { url: true, token: true, platform: true } },
    },
  })

  if (!pr) throw createError({ statusCode: 404, statusMessage: 'Pull request not found' })
  if (!pr.task) throw createError({ statusCode: 400, statusMessage: 'No task linked to this pull request' })

  const taskId = pr.task.id

  // Refresh comments from GitHub for the latest feedback
  const parsed = parseGithubUrl(pr.url)
  let comments: any[] = []

  if (parsed) {
    try {
      const reviewComments = await fetchPullRequestComments(
        parsed.owner, parsed.repo, parsed.number,
        parsed.host, parsed.isEnterprise, pr.repository?.token
      )
      const issueComments = await fetchIssueComments(
        parsed.owner, parsed.repo, parsed.number,
        parsed.host, parsed.isEnterprise, pr.repository?.token
      )
      const reviews = await fetchPullRequestReviews(
        parsed.owner, parsed.repo, parsed.number,
        parsed.host, parsed.isEnterprise, pr.repository?.token
      )

      const reviewState = determineReviewState(reviews)

      // Merge and dedupe
      const allComments = [
        ...reviewComments.map((c: any) => ({
          id: c.id,
          author: c.user?.login || 'unknown',
          body: c.body || '',
          path: c.path || null,
          line: c.line || null,
          isReview: true,
          createdAt: c.created_at || '',
        })),
        ...issueComments.map((c: any) => ({
          id: c.id,
          author: c.user?.login || 'unknown',
          body: c.body || '',
          path: null,
          line: null,
          isReview: false,
          createdAt: c.created_at || '',
        })),
        ...reviews.filter((r: any) => r.body).map((r: any) => ({
          id: r.id,
          author: r.user?.login || 'unknown',
          body: r.body,
          path: null,
          line: null,
          isReview: true,
          createdAt: r.submitted_at || '',
        })),
      ]

      // Deduplicate by body+author
      const seen = new Set<string>()
      comments = allComments.filter((c) => {
        const key = `${c.author}:${c.body}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

      // Persist refreshed comments
      await db.delete(schema.prComments).where(eq(schema.prComments.taskId, taskId))
      if (comments.length > 0) {
        await db.insert(schema.prComments).values(
          comments.map((c) => ({
            taskId,
            pullRequestId: pr.id,
            githubCommentId: c.id,
            author: c.author,
            body: c.body,
            path: c.path,
            line: c.line,
            isReview: c.isReview,
            reviewState,
            createdAt: c.createdAt,
          }))
        )
      }

      // Update PR review state
      await db.update(schema.pullRequests)
        .set({ reviewState, lastSyncedAt: new Date() })
        .where(eq(schema.pullRequests.id, prId))
    } catch {
      // Fall back to cached comments
      comments = await db.query.prComments.findMany({
        where: eq(schema.prComments.taskId, taskId),
        orderBy: [desc(schema.prComments.syncedAt)],
      })
    }
  } else {
    comments = await db.query.prComments.findMany({
      where: eq(schema.prComments.taskId, taskId),
      orderBy: [desc(schema.prComments.syncedAt)],
    })
  }

  if (comments.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No review comments found to fix' })
  }

  const feedbackText = comments
    .map((c: any) => {
      const location = c.path ? ` (File: ${c.path}${c.line ? `, line ${c.line}` : ''})` : ''
      return `[Comment by ${c.author}]${location}\n${stripHtml(c.body)}`
    })
    .join('\n\n---\n\n')
    .slice(0, 5000)

  // Store feedback so the runtime can pick it up
  pendingFeedback.set(taskId, feedbackText)

  // Update PR agent fix status
  await db.update(schema.pullRequests)
    .set({ agentFixStatus: 'in_progress' })
    .where(eq(schema.pullRequests.id, prId))

  // Log the action
  try {
    await db.insert(schema.activityLogs).values({
      taskId,
      userId,
      action: 'fix_feedback',
      newValue: { message: `Agent fixing ${comments.length} feedback items from PR review`, pullRequestId: prId },
    })
  } catch {}

  return { success: true, taskId, commentCount: comments.length, feedbackLength: feedbackText.length, pullRequestId: prId }
}
