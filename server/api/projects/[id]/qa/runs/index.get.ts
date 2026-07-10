import { requireProjectAccess } from '~/server/utils/auth'
import { listProjectQaRuns } from '~/server/utils/qa-runs'

export default defineEventHandler(async (event) => {
  const { id: projectId } = getRouterParams(event)
  await requireProjectAccess(event, projectId)
  return listProjectQaRuns(projectId)
})
