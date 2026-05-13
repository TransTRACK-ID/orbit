import { requireAuth } from '~/server/utils/auth'
import { executeFixFeedback } from '~/server/utils/fix-feedback'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)

  const result = await executeFixFeedback(id, user.id)
  return result
})
