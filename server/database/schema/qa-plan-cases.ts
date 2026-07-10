import { pgTable, uuid, integer, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { qaPlans } from './qa-plans'
import { qaCases } from './qa-cases'

export const qaPlanCases = pgTable('qa_plan_cases', {
  planId: uuid('plan_id').notNull().references(() => qaPlans.id, { onDelete: 'cascade' }),
  caseId: uuid('case_id').notNull().references(() => qaCases.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => ({
  planCaseUnique: unique('qa_plan_cases_plan_case_unique').on(t.planId, t.caseId),
}))

export const qaPlanCasesRelations = relations(qaPlanCases, ({ one }) => ({
  plan: one(qaPlans, {
    fields: [qaPlanCases.planId],
    references: [qaPlans.id],
  }),
  case: one(qaCases, {
    fields: [qaPlanCases.caseId],
    references: [qaCases.id],
  }),
}))

export type QaPlanCase = typeof qaPlanCases.$inferSelect
export type NewQaPlanCase = typeof qaPlanCases.$inferInsert
