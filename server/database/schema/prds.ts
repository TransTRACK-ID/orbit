import { pgTable, uuid, varchar, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { brainstorms } from './brainstorms'
import { projects } from './projects'
import { workspaces } from './workspaces'
import { prdSections } from './prd-sections'

export const prds = pgTable('prds', {
  id: uuid('id').primaryKey().defaultRandom(),
  brainstormId: uuid('brainstorm_id').notNull().references(() => brainstorms.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 500 }).notNull(),
  content: text('content').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  version: integer('version').notNull().default(1),
  tasksGenerated: boolean('tasks_generated').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export const prdsRelations = relations(prds, ({ one, many }) => ({
  brainstorm: one(brainstorms, {
    fields: [prds.brainstormId],
    references: [brainstorms.id],
  }),
  workspace: one(workspaces, {
    fields: [prds.workspaceId],
    references: [workspaces.id],
  }),
  project: one(projects, {
    fields: [prds.projectId],
    references: [projects.id],
  }),
  sections: many(prdSections),
}))

export type Prd = typeof prds.$inferSelect
export type NewPrd = typeof prds.$inferInsert
