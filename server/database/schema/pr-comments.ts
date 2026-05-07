import { pgTable, uuid, varchar, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tasks } from './tasks'

export const prComments = pgTable('pr_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  githubCommentId: integer('github_comment_id').notNull(),
  author: varchar('author', { length: 255 }).notNull(),
  body: text('body').notNull(),
  path: varchar('path', { length: 500 }),
  line: integer('line'),
  isReview: boolean('is_review').notNull().default(true),
  createdAt: varchar('created_at', { length: 100 }),
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
})

export const prCommentsRelations = relations(prComments, ({ one }) => ({
  task: one(tasks, {
    fields: [prComments.taskId],
    references: [tasks.id],
  }),
}))

export type PrComment = typeof prComments.$inferSelect
export type NewPrComment = typeof prComments.$inferInsert
