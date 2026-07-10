import { pgTable, uuid, varchar, integer, timestamp, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { projects } from './projects'
import { qaCases } from './qa-cases'

export const qaSuites = pgTable('qa_suites', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id').references((): AnyPgColumn => qaSuites.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export const qaSuitesRelations = relations(qaSuites, ({ one, many }) => ({
  project: one(projects, {
    fields: [qaSuites.projectId],
    references: [projects.id],
  }),
  parent: one(qaSuites, {
    fields: [qaSuites.parentId],
    references: [qaSuites.id],
    relationName: 'suite_hierarchy',
  }),
  children: many(qaSuites, { relationName: 'suite_hierarchy' }),
  cases: many(qaCases),
}))

export type QaSuite = typeof qaSuites.$inferSelect
export type NewQaSuite = typeof qaSuites.$inferInsert
