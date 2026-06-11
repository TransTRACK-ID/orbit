import { pgTable, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core'

export interface AgentRuntimeSettingsValue {
  disabled: string[]
}

export const platformSettings = pgTable('platform_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').$type<AgentRuntimeSettingsValue>().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export const AGENT_RUNTIMES_SETTINGS_KEY = 'agent_runtimes'

export type PlatformSetting = typeof platformSettings.$inferSelect
export type NewPlatformSetting = typeof platformSettings.$inferInsert
