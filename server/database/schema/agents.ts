import { pgTable, uuid, varchar, text, integer, timestamp, boolean } from 'drizzle-orm/pg-core'
import { users } from './users'

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  initials: varchar('initials', { length: 10 }).notNull(),
  role: varchar('role', { length: 255 }).notNull(),
  runtime: varchar('runtime', { length: 50 }).notNull(),
  purpose: text('purpose'),
  status: varchar('status', { length: 20 }).notNull().default('idle'),
  color: varchar('color', { length: 7 }).notNull().default('#7C3AED'),
  tasks: integer('tasks').notNull().default(0),
  headed: boolean('headed').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})
