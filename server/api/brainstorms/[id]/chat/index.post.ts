import { requireAuth } from '~/server/utils/auth'
import { pendingBrainstormMessages } from '~/server/utils/brainstorm-runtime'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)

  const body = await readBody<{ message?: string }>(event)
  const message = body?.message || ''

  if (message) {
    pendingBrainstormMessages.set(id, message)
  }

  return { stored: true }
})
