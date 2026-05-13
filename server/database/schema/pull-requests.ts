import { pgTable, uuid, varchar, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tasks } from './tasks'
import { repositories } from './repositories'
import { prComments } from './pr-comments'

export const pullRequests = pgTable('pull_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }).unique(),
  repositoryId: uuid('repository_id').references(() => repositories.id, { onDelete: 'set null' }),
  githubNumber: integer('github_number').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  draft: boolean('draft').notNull().default(false),
  reviewState: varchar('review_state', { length: 30 }).notNull().default('pending'),
  mergeableState: varchar('mergeable_state', { length: 30 }),
  headBranch: varchar('head_branch', { length: 255 }),
  baseBranch: varchar('base_branch', { length: 255 }),
  agentFixStatus: varchar('agent_fix_status', { length: 30 }).notNull().default('none'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
  lastSyncedAt: timestamp('last_synced_at').defaultNow().notNull(),
})

export const pullRequestsRelations = relations(pullRequests, ({ one, many }) => ({
  task: one(tasks, {
    fields: [pullRequests.taskId],
    references: [tasks.id],
  }),
  repository: one(repositories, {
    fields: [pullRequests.repositoryId],
    references: [repositories.id],
  }),
  comments: many(prComments),
}))

export type PullRequest = typeof pullRequests.$inferSelect
export type NewPullRequest = typeof pullRequests.$inferInsert
