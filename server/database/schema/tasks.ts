import { pgTable, uuid, varchar, text, doublePrecision, timestamp, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { agents } from './agents'
import { projects } from './projects'
import { statuses } from './statuses'
import { taskLabels } from './task-labels'
import { comments } from './comments'
import { activityLogs } from './activity-logs'
import { repositories } from './repositories'
import { taskAttachments } from './task-attachments'

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  statusId: uuid('status_id').notNull().references(() => statuses.id, { onDelete: 'cascade' }),
  assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  agentAssigneeId: uuid('agent_assignee_id').references(() => agents.id, { onDelete: 'set null' }),
  assigneeType: varchar('assignee_type', { length: 10 }),
  observerId: uuid('observer_id').references(() => users.id, { onDelete: 'set null' }),
  reporterId: uuid('reporter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  position: doublePrecision('position').notNull().default(0),
  priority: varchar('priority', { length: 10 }).notNull().default('none'),
  repositoryId: uuid('repository_id').references(() => repositories.id, { onDelete: 'set null' }),
  parentTaskId: uuid('parent_task_id').references((): typeof tasks.id => tasks.id, { onDelete: 'cascade' }),
  dueDate: timestamp('due_date'),
  estimate: integer('estimate'),
  branchName: varchar('branch_name', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  repository: one(repositories, {
    fields: [tasks.repositoryId],
    references: [repositories.id],
  }),
  status: one(statuses, {
    fields: [tasks.statusId],
    references: [statuses.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
  }),
  agentAssignee: one(agents, {
    fields: [tasks.agentAssigneeId],
    references: [agents.id],
  }),
  observer: one(users, {
    fields: [tasks.observerId],
    references: [users.id],
  }),
  reporter: one(users, {
    fields: [tasks.reporterId],
    references: [users.id],
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: 'subtasks',
  }),
  subtasks: many(tasks, { relationName: 'subtasks' }),
  taskLabels: many(taskLabels),
  comments: many(comments),
  activityLogs: many(activityLogs),
  attachments: many(taskAttachments),
}))

export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
