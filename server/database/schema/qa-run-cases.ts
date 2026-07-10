import { pgTable, uuid, varchar, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { qaRuns } from './qa-runs'
import { qaCases, type QaCaseStep } from './qa-cases'
import { qaRunAttachments } from './qa-run-attachments'

export const qaRunCases = pgTable('qa_run_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => qaRuns.id, { onDelete: 'cascade' }),
  caseId: uuid('case_id').references(() => qaCases.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 500 }).notNull(),
  steps: jsonb('steps').$type<QaCaseStep[]>().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  actual: text('actual'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export const qaRunCasesRelations = relations(qaRunCases, ({ one, many }) => ({
  run: one(qaRuns, {
    fields: [qaRunCases.runId],
    references: [qaRuns.id],
  }),
  case: one(qaCases, {
    fields: [qaRunCases.caseId],
    references: [qaCases.id],
  }),
  attachments: many(qaRunAttachments),
}))

export type QaRunCase = typeof qaRunCases.$inferSelect
export type NewQaRunCase = typeof qaRunCases.$inferInsert
