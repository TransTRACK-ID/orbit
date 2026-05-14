import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { workspaces } from './workspaces'

export const workspaceEnvVars = pgTable('workspace_env_vars', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  key: varchar('key', { length: 255 }).notNull(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export const workspaceEnvVarsRelations = relations(workspaceEnvVars, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceEnvVars.workspaceId],
    references: [workspaces.id],
  }),
}))

export type WorkspaceEnvVar = typeof workspaceEnvVars.$inferSelect
export type NewWorkspaceEnvVar = typeof workspaceEnvVars.$inferInsert
