import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { repositories } from './repositories'

export const repositoryEnvVars = pgTable('repository_env_vars', {
  id: uuid('id').primaryKey().defaultRandom(),
  repositoryId: uuid('repository_id').notNull().references(() => repositories.id, { onDelete: 'cascade' }),
  key: varchar('key', { length: 255 }).notNull(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export const repositoryEnvVarsRelations = relations(repositoryEnvVars, ({ one }) => ({
  repository: one(repositories, {
    fields: [repositoryEnvVars.repositoryId],
    references: [repositories.id],
  }),
}))

export type RepositoryEnvVar = typeof repositoryEnvVars.$inferSelect
export type NewRepositoryEnvVar = typeof repositoryEnvVars.$inferInsert
