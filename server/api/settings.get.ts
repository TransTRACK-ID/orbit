import { getAppSettings } from '~/server/utils/app-settings'

export default defineEventHandler(async (event) => {
  const settings = await getAppSettings()
  return settings
})
