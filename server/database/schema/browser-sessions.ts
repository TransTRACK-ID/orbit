import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tasks } from './tasks'
import { agents } from './agents'

export const browserSessions = pgTable('browser_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 20 }).notNull().default('running'),
  summary: text('summary'),
  error: text('error'),
  screenshotPath: varchar('screenshot_path', { length: 500 }),
  outputDir: varchar('output_dir', { length: 500 }),
  headed: boolean('headed').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export const browserSessionsRelations = relations(browserSessions, ({ one }) => ({
  task: one(tasks, {
    fields: [browserSessions.taskId],
    references: [tasks.id],
  }),
  agent: one(agents, {
    fields: [browserSessions.agentId],
    references: [agents.id],
  }),
}))

export type BrowserSession = typeof browserSessions.$inferSelect
export type NewBrowserSession = typeof browserSessions.$inferInsert
