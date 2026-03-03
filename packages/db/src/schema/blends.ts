import { pgTable, uuid, varchar, decimal, boolean, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { keywords } from './keywords';
import { flavors } from './flavors';
import type { NoteType } from './flavors';

export const blendStatusEnum = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const;
export type BlendStatus = (typeof blendStatusEnum)[number];

export const blendRequests = pgTable('blend_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  creatorId: uuid('creator_id').references(() => users.id),
  topRatio: decimal('top_ratio', { precision: 5, scale: 2 }).notNull(),
  middleRatio: decimal('middle_ratio', { precision: 5, scale: 2 }).notNull(),
  lastRatio: decimal('last_ratio', { precision: 5, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('PENDING').$type<BlendStatus>(),
  manualBlend: boolean('manual_blend').notNull().default(false),
  name: varchar('name', { length: 100 }),
  parentBlendId: uuid('parent_blend_id').references((): any => blendRequests.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_blend_requests_user').on(table.userId),
  index('idx_blend_requests_parent').on(table.parentBlendId),
]);

export const blendRequestKeywords = pgTable('blend_request_keywords', {
  id: uuid('id').primaryKey().defaultRandom(),
  blendRequestId: uuid('blend_request_id').notNull().references(() => blendRequests.id, { onDelete: 'cascade' }),
  keywordId: uuid('keyword_id').notNull().references(() => keywords.id),
  weight: decimal('weight', { precision: 3, scale: 0 }).notNull(),
}, (table) => [
  index('idx_blend_request_keywords_request').on(table.blendRequestId),
]);

export const blendRequestFlavors = pgTable('blend_request_flavors', {
  id: uuid('id').primaryKey().defaultRandom(),
  blendRequestId: uuid('blend_request_id').notNull().references(() => blendRequests.id, { onDelete: 'cascade' }),
  flavorId: uuid('flavor_id').notNull().references(() => flavors.id),
  ratio: decimal('ratio', { precision: 5, scale: 2 }).notNull(),
  noteType: varchar('note_type', { length: 10 }).notNull().$type<NoteType>(),
}, (table) => [
  index('idx_blend_request_flavors_request').on(table.blendRequestId),
]);

export const blendResults = pgTable('blend_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  blendRequestId: uuid('blend_request_id').notNull().unique().references(() => blendRequests.id, { onDelete: 'cascade' }),
  story: text('story'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const blendResultFlavors = pgTable('blend_result_flavors', {
  id: uuid('id').primaryKey().defaultRandom(),
  blendResultId: uuid('blend_result_id').notNull().references(() => blendResults.id, { onDelete: 'cascade' }),
  flavorId: uuid('flavor_id').notNull().references(() => flavors.id),
  ratio: decimal('ratio', { precision: 5, scale: 2 }).notNull(),
  noteType: varchar('note_type', { length: 10 }).notNull().$type<NoteType>(),
}, (table) => [
  index('idx_blend_result_flavors_result').on(table.blendResultId),
]);

// Relations
export const blendRequestsRelations = relations(blendRequests, ({ one, many }) => ({
  user: one(users, { fields: [blendRequests.userId], references: [users.id], relationName: 'blendRequestUser' }),
  creator: one(users, { fields: [blendRequests.creatorId], references: [users.id], relationName: 'blendRequestCreator' }),
  parent: one(blendRequests, { fields: [blendRequests.parentBlendId], references: [blendRequests.id], relationName: 'blendParentChild' }),
  children: many(blendRequests, { relationName: 'blendParentChild' }),
  keywords: many(blendRequestKeywords),
  flavors: many(blendRequestFlavors),
  result: one(blendResults),
}));

export const blendRequestKeywordsRelations = relations(blendRequestKeywords, ({ one }) => ({
  blendRequest: one(blendRequests, { fields: [blendRequestKeywords.blendRequestId], references: [blendRequests.id] }),
  keyword: one(keywords, { fields: [blendRequestKeywords.keywordId], references: [keywords.id] }),
}));

export const blendRequestFlavorsRelations = relations(blendRequestFlavors, ({ one }) => ({
  blendRequest: one(blendRequests, { fields: [blendRequestFlavors.blendRequestId], references: [blendRequests.id] }),
  flavor: one(flavors, { fields: [blendRequestFlavors.flavorId], references: [flavors.id] }),
}));

export const blendResultsRelations = relations(blendResults, ({ one, many }) => ({
  blendRequest: one(blendRequests, { fields: [blendResults.blendRequestId], references: [blendRequests.id] }),
  flavors: many(blendResultFlavors),
}));

export const blendResultFlavorsRelations = relations(blendResultFlavors, ({ one }) => ({
  blendResult: one(blendResults, { fields: [blendResultFlavors.blendResultId], references: [blendResults.id] }),
  flavor: one(flavors, { fields: [blendResultFlavors.flavorId], references: [flavors.id] }),
}));
