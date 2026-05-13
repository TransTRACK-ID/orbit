import { pgTable, uuid, varchar, text, integer, bigint, boolean, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tasks } from './tasks'
import { pullRequests } from './pull-requests'

export const prComments = pgTable('pr_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  pullRequestId: uuid('pull_request_id').references(() => pullRequests.id, { onDelete: 'cascade' }),
  githubCommentId: bigint('github_comment_id', { mode: 'number' }).notNull(),
  author: varchar('author', { length: 255 }).notNull(),
  body: text('body').notNull(),
  path: varchar('path', { length: 500 }),
  line: integer('line'),
  isReview: boolean('is_review').notNull().default(true),
  reviewState: varchar('review_state', { length: 30 }),
  resolved: boolean('resolved').notNull().default(false),
  agentFixAppliedAt: timestamp('agent_fix_applied_at'),
  createdAt: varchar('created_at', { length: 100 }),
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
})

export const prCommentsRelations = relations(prComments, ({ one }) => ({
  task: one(tasks, {
    fields: [prComments.taskId],
    references: [tasks.id],
  }),
  pullRequest: one(pullRequests, {
    fields: [prComments.pullRequestId],
    references: [pullRequests.id],
  }),
}))

export type PrComment = typeof prComments.$inferSelect
export type NewPrComment = typeof prComments.$inferInsert
