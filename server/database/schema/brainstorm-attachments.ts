import { pgTable, uuid, varchar, integer, timestamp, text } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { brainstorms } from './brainstorms'

export const brainstormAttachments = pgTable('brainstorm_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  brainstormId: uuid('brainstorm_id').notNull().references(() => brainstorms.id, { onDelete: 'cascade' }),
  filename: varchar('filename', { length: 255 }).notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  size: integer('size').notNull(),
  path: varchar('path', { length: 500 }).notNull(),
  extractedText: text('extracted_text'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const brainstormAttachmentsRelations = relations(brainstormAttachments, ({ one }) => ({
  brainstorm: one(brainstorms, {
    fields: [brainstormAttachments.brainstormId],
    references: [brainstorms.id],
  }),
}))

export type BrainstormAttachment = typeof brainstormAttachments.$inferSelect
export type NewBrainstormAttachment = typeof brainstormAttachments.$inferInsert
