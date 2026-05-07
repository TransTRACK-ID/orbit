import { requireAuth } from '~/server/utils/auth'
import { pendingFeedback } from '~/server/utils/runtime'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)

  const body = await readBody<{ feedback?: string }>(event)
  const feedback = body?.feedback || ''

  if (feedback) {
    pendingFeedback.set(id, feedback)
  }

  return { stored: true }
})
