import { pgTable, uuid, varchar, boolean, integer, timestamp, index } from 'drizzle-orm/pg-core';

export const categoryEnum = ['SEASON', 'PLACE', 'MOOD', 'FREE'] as const;
export type Category = (typeof categoryEnum)[number];

export const keywords = pgTable('keywords', {
  id: uuid('id').primaryKey().defaultRandom(),
  word: varchar('word', { length: 100 }).notNull(),
  category: varchar('category', { length: 20 }).notNull().default('FREE').$type<Category>(),
  isPreset: boolean('is_preset').notNull().default(false),
  usageCount: integer('usage_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_keywords_word').on(table.word),
]);
