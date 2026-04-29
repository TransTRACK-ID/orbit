import { pgTable, uuid, varchar, integer, boolean, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { projects } from './projects'
import { tasks } from './tasks'

export const statuses = pgTable('statuses', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  position: integer('position').notNull().default(0),
  color: varchar('color', { length: 7 }).notNull().default('#94a3b8'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const statusesRelations = relations(statuses, ({ one, many }) => ({
  project: one(projects, {
    fields: [statuses.projectId],
    references: [projects.id],
  }),
  tasks: many(tasks),
}))

export type Status = typeof statuses.$inferSelect
export type NewStatus = typeof statuses.$inferInsert
