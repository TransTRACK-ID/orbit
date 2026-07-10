import { pgTable, uuid, varchar, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { projects } from './projects'
import { qaSuites } from './qa-suites'
import { qaPlanCases } from './qa-plan-cases'
import { qaRunCases } from './qa-run-cases'

export type QaCaseStep = {
  order: number
  action: string
  expected: string
}

export const qaCases = pgTable('qa_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  suiteId: uuid('suite_id').references(() => qaSuites.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 500 }).notNull(),
  preconditions: text('preconditions'),
  steps: jsonb('steps').$type<QaCaseStep[]>().notNull().default([]),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export const qaCasesRelations = relations(qaCases, ({ one, many }) => ({
  project: one(projects, {
    fields: [qaCases.projectId],
    references: [projects.id],
  }),
  suite: one(qaSuites, {
    fields: [qaCases.suiteId],
    references: [qaSuites.id],
  }),
  planCases: many(qaPlanCases),
  runCases: many(qaRunCases),
}))

export type QaCase = typeof qaCases.$inferSelect
export type NewQaCase = typeof qaCases.$inferInsert
