import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { brainstorms } from './brainstorms'

export const brainstormMessages = pgTable('brainstorm_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  brainstormId: uuid('brainstorm_id').notNull().references(() => brainstorms.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const brainstormMessagesRelations = relations(brainstormMessages, ({ one }) => ({
  brainstorm: one(brainstorms, {
    fields: [brainstormMessages.brainstormId],
    references: [brainstorms.id],
  }),
}))

export type BrainstormMessage = typeof brainstormMessages.$inferSelect
export type NewBrainstormMessage = typeof brainstormMessages.$inferInsert
