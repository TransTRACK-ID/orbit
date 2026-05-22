import { eq } from 'drizzle-orm'
import { getDb, schema } from '~/server/database'

export interface AppSettings {
  loginRequired: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  loginRequired: true,
}

export async function getAppSettings(): Promise<AppSettings> {
  const db = getDb()
  const setting = await db.query.appSettings.findFirst({
    where: eq(schema.appSettings.key, 'app_config'),
  })

  if (!setting) {
    return DEFAULT_SETTINGS
  }

  return { ...DEFAULT_SETTINGS, ...(setting.value as AppSettings) }
}

export async function updateAppSettings(settings: Partial<AppSettings>) {
  const db = getDb()
  const existing = await db.query.appSettings.findFirst({
    where: eq(schema.appSettings.key, 'app_config'),
  })

  const newValue = existing
    ? { ...(existing.value as AppSettings), ...settings }
    : { ...DEFAULT_SETTINGS, ...settings }

  if (existing) {
    await db
      .update(schema.appSettings)
      .set({ value: newValue })
      .where(eq(schema.appSettings.key, 'app_config'))
  } else {
    await db.insert(schema.appSettings).values({
      key: 'app_config',
      value: newValue,
    })
  }

  return newValue as AppSettings
}
