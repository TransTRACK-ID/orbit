import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { workspaces } from './workspaces'
import { docsVersions } from './docs-versions'

export const docsApps = pgTable('docs_apps', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  currentVersion: varchar('current_version', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export const docsAppsRelations = relations(docsApps, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [docsApps.workspaceId],
    references: [workspaces.id],
  }),
  versions: many(docsVersions),
}))

export type DocsApp = typeof docsApps.$inferSelect
export type NewDocsApp = typeof docsApps.$inferInsert
