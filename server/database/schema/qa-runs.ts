import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { projects } from './projects'
import { qaPlans } from './qa-plans'
import { tasks } from './tasks'
import { agents } from './agents'
import { qaRunCases } from './qa-run-cases'

export const qaRuns = pgTable('qa_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').references(() => qaPlans.id, { onDelete: 'set null' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  targetUrl: varchar('target_url', { length: 2000 }),
  runtime: varchar('runtime', { length: 20 }).notNull().default('cursor'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  summary: text('summary'),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export const qaRunsRelations = relations(qaRuns, ({ one, many }) => ({
  project: one(projects, {
    fields: [qaRuns.projectId],
    references: [projects.id],
  }),
  plan: one(qaPlans, {
    fields: [qaRuns.planId],
    references: [qaPlans.id],
  }),
  task: one(tasks, {
    fields: [qaRuns.taskId],
    references: [tasks.id],
  }),
  agent: one(agents, {
    fields: [qaRuns.agentId],
    references: [agents.id],
  }),
  runCases: many(qaRunCases),
}))

export type QaRun = typeof qaRuns.$inferSelect
export type NewQaRun = typeof qaRuns.$inferInsert
