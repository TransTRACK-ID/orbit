import { pgTable, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tasks } from './tasks'
import { agents } from './agents'
import { projects } from './projects'

export const agentTaskContext = pgTable('agent_task_context', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('running'),
  branchName: varchar('branch_name', { length: 255 }),
  summary: text('summary'),
  filesChanged: jsonb('files_changed').$type<string[]>().default([]),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export const agentTaskContextRelations = relations(agentTaskContext, ({ one }) => ({
  task: one(tasks, {
    fields: [agentTaskContext.taskId],
    references: [tasks.id],
  }),
  agent: one(agents, {
    fields: [agentTaskContext.agentId],
    references: [agents.id],
  }),
  project: one(projects, {
    fields: [agentTaskContext.projectId],
    references: [projects.id],
  }),
}))

export type AgentTaskContext = typeof agentTaskContext.$inferSelect
export type NewAgentTaskContext = typeof agentTaskContext.$inferInsert
