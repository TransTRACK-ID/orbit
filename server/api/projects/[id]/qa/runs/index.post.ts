import { requireProjectAccess } from '~/server/utils/auth'
import { createQaRunSchema } from '~/server/utils/validation'
import { createQaRunWithSnapshot } from '~/server/utils/qa-runs'

export default defineEventHandler(async (event) => {
  const { id: projectId } = getRouterParams(event)
  await requireProjectAccess(event, projectId)
  const body = await readValidatedBody(event, createQaRunSchema.parse)

  return createQaRunWithSnapshot({
    projectId,
    planId: body.planId,
    caseIds: body.caseIds,
    taskId: body.taskId,
    agentId: body.agentId,
    targetUrl: body.targetUrl,
    runtime: body.runtime,
  })
})
