import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { qaRunCases } from './qa-run-cases'

export const qaRunAttachments = pgTable('qa_run_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  runCaseId: uuid('run_case_id').notNull().references(() => qaRunCases.id, { onDelete: 'cascade' }),
  filename: varchar('filename', { length: 255 }).notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  size: integer('size').notNull(),
  path: varchar('path', { length: 500 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const qaRunAttachmentsRelations = relations(qaRunAttachments, ({ one }) => ({
  runCase: one(qaRunCases, {
    fields: [qaRunAttachments.runCaseId],
    references: [qaRunCases.id],
  }),
}))

export type QaRunAttachment = typeof qaRunAttachments.$inferSelect
export type NewQaRunAttachment = typeof qaRunAttachments.$inferInsert
