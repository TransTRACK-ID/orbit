import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { docsApps } from './docs-apps'

export const docsVersions = pgTable('docs_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  appId: uuid('app_id').notNull().references(() => docsApps.id, { onDelete: 'cascade' }),
  version: varchar('version', { length: 50 }).notNull(),
  date: varchar('date', { length: 20 }).notNull(),
  author: varchar('author', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export const docsVersionsRelations = relations(docsVersions, ({ one }) => ({
  app: one(docsApps, {
    fields: [docsVersions.appId],
    references: [docsApps.id],
  }),
}))

export type DocsVersion = typeof docsVersions.$inferSelect
export type NewDocsVersion = typeof docsVersions.$inferInsert
