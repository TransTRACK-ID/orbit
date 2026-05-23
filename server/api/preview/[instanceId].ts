import { proxyPreviewRequest } from '~/server/utils/preview-proxy-v2'

export default defineEventHandler(async (event) => {
  const { instanceId } = getRouterParams(event)
  if (!instanceId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing instanceId' })
  }
  return proxyPreviewRequest(event, instanceId)
})
