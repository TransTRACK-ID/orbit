import { pgTable, uuid, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { docsVersions } from './docs-versions'

export interface ReleaseFeatureMedia {
  type: 'image' | 'video'
  src: string
  alt: string
}

export interface ReleaseFeature {
  id: string
  heading: string
  description: string
  media: ReleaseFeatureMedia[]
}

export interface ReleaseCategories {
  fixed?: string[]
  added?: string[]
  changed?: string[]
  deprecated?: string[]
  security?: string[]
}

export const docsReleases = pgTable('docs_releases', {
  id: uuid('id').primaryKey().defaultRandom(),
  versionId: uuid('version_id').notNull().references(() => docsVersions.id, { onDelete: 'cascade' }).unique(),
  published: boolean('published').notNull().default(false),
  heroTitle: text('hero_title'),
  summary: text('summary'),
  features: jsonb('features').$type<ReleaseFeature[]>().default([]),
  categories: jsonb('categories').$type<ReleaseCategories>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export const docsReleasesRelations = relations(docsReleases, ({ one }) => ({
  version: one(docsVersions, {
    fields: [docsReleases.versionId],
    references: [docsVersions.id],
  }),
}))

export type DocsRelease = typeof docsReleases.$inferSelect
export type NewDocsRelease = typeof docsReleases.$inferInsert
