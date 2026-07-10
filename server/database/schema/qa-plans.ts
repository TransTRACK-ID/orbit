import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { projects } from './projects'
import { qaPlanCases } from './qa-plan-cases'
import { qaRuns } from './qa-runs'

export const qaPlans = pgTable('qa_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export const qaPlansRelations = relations(qaPlans, ({ one, many }) => ({
  project: one(projects, {
    fields: [qaPlans.projectId],
    references: [projects.id],
  }),
  planCases: many(qaPlanCases),
  runs: many(qaRuns),
}))

export type QaPlan = typeof qaPlans.$inferSelect
export type NewQaPlan = typeof qaPlans.$inferInsert
