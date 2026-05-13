import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { parseGithubUrl, fetchPullRequestDetails, fetchPullRequestReviews, determineReviewState } from '~/server/utils/github-api'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)

  const db = getDb()

  const pr = await db.query.pullRequests.findFirst({
    where: eq(schema.pullRequests.id, id),
    with: { repository: { columns: { url: true, token: true } } },
  })

  if (!pr) throw createError({ statusCode: 404, statusMessage: 'Pull request not found' })

  const parsed = parseGithubUrl(pr.url)
  if (!parsed) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid PR URL format' })
  }

  try {
    const details = await fetchPullRequestDetails(
      parsed.owner,
      parsed.repo,
      parsed.number,
      parsed.host,
      parsed.isEnterprise,
      pr.repository?.token
    )

    const reviews = await fetchPullRequestReviews(
      parsed.owner,
      parsed.repo,
      parsed.number,
      parsed.host,
      parsed.isEnterprise,
      pr.repository?.token
    )

    const reviewState = determineReviewState(reviews)

    const updated = await db.update(schema.pullRequests)
      .set({
        title: details.title,
        status: details.status,
        draft: details.draft,
        reviewState,
        mergeableState: details.mergeableState,
        headBranch: details.headBranch,
        baseBranch: details.baseBranch,
        createdAt: details.createdAt,
        updatedAt: details.updatedAt,
        lastSyncedAt: new Date(),
      })
      .where(eq(schema.pullRequests.id, id))
      .returning()

    return { pullRequest: updated[0], synced: true }
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: `Sync failed: ${err.message}` })
  }
})
