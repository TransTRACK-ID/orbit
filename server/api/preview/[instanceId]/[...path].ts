import { proxyPreviewRequest } from '~/server/utils/preview-proxy-v2'

export default defineEventHandler(async (event) => {
  const { instanceId } = getRouterParams(event)
  return proxyPreviewRequest(event, instanceId)
})
