import { pgTable, uuid, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tasks } from './tasks'

export const previewInstances = pgTable('preview_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('building'),
  framework: varchar('framework', { length: 50 }).notNull(),
  mode: varchar('mode', { length: 10 }).notNull().default('build'),
  port: integer('port'),
  worktreeDir: text('worktree_dir').notNull(),
  outputDir: text('output_dir'),
  pid: integer('pid'),
  logs: text('logs').array().default([]),
  failReason: text('fail_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export const previewInstancesRelations = relations(previewInstances, ({ one }) => ({
  task: one(tasks, {
    fields: [previewInstances.taskId],
    references: [tasks.id],
  }),
}))

export type PreviewInstance = typeof previewInstances.$inferSelect
export type NewPreviewInstance = typeof previewInstances.$inferInsert
