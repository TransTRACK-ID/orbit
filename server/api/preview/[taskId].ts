import { defineEventHandler, getRouterParams } from 'h3'
import { proxyPreviewRequest } from '~/server/utils/preview-proxy'

export default defineEventHandler(async (event) => {
  const { taskId } = getRouterParams(event)
  return proxyPreviewRequest(event, taskId)
})
