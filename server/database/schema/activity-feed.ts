import { pgTable, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { workspaces } from './workspaces'
import { users } from './users'

export const activityFeed = pgTable('activity_feed', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: text('entity_id'),
  entityName: text('entity_name'),
  action: varchar('action', { length: 50 }).notNull(),
  message: text('message').notNull(),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const activityFeedRelations = relations(activityFeed, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [activityFeed.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [activityFeed.userId],
    references: [users.id],
  }),
}))

export type ActivityFeedEntry = typeof activityFeed.$inferSelect
export type NewActivityFeedEntry = typeof activityFeed.$inferInsert
