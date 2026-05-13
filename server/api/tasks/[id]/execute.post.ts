import { requireAuth } from '~/server/utils/auth'
import { pendingFeedback } from '~/server/utils/runtime'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)

  const body = await readBody(event)
  const feedback = body?.feedback as string | undefined

  if (feedback && feedback.length > 0) {
    pendingFeedback.set(id, feedback)
  }

  return { stored: true }
})
