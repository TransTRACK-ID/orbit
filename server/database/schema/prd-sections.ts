import { pgTable, uuid, varchar, text, timestamp, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { prds } from './prds'

export const prdSections = pgTable('prd_sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  prdId: uuid('prd_id').notNull().references(() => prds.id, { onDelete: 'cascade' }),
  sectionType: varchar('section_type', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const prdSectionsRelations = relations(prdSections, ({ one }) => ({
  prd: one(prds, {
    fields: [prdSections.prdId],
    references: [prds.id],
  }),
}))

export type PrdSection = typeof prdSections.$inferSelect
export type NewPrdSection = typeof prdSections.$inferInsert
