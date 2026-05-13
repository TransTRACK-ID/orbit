import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { workspaces } from './workspaces'
import { repositories } from './repositories'
import { brainstormMessages } from './brainstorm-messages'

export const brainstorms = pgTable('brainstorms', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  repositoryId: uuid('repository_id').references(() => repositories.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export const brainstormsRelations = relations(brainstorms, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [brainstorms.workspaceId],
    references: [workspaces.id],
  }),
  repository: one(repositories, {
    fields: [brainstorms.repositoryId],
    references: [repositories.id],
  }),
  messages: many(brainstormMessages),
}))

export type Brainstorm = typeof brainstorms.$inferSelect
export type NewBrainstorm = typeof brainstorms.$inferInsert
