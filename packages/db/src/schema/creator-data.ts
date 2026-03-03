import { pgTable, uuid, varchar, decimal, text, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { flavors } from './flavors';

// ---------------------------------------------------------------------------
// Weight / Temperature enums
// ---------------------------------------------------------------------------

export const flavorWeightEnum = ['light', 'medium', 'heavy'] as const;
export type FlavorWeight = (typeof flavorWeightEnum)[number];

export const flavorTemperatureEnum = ['cool', 'neutral', 'warm'] as const;
export type FlavorTemperature = (typeof flavorTemperatureEnum)[number];

// ---------------------------------------------------------------------------
// Creator Flavor Notes - クリエイター独自の香料物性データ
// ---------------------------------------------------------------------------

export const creatorFlavorNotes = pgTable('creator_flavor_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull().references(() => users.id),
  flavorId: uuid('flavor_id').notNull().references(() => flavors.id),
  volatility: decimal('volatility', { precision: 5, scale: 2 }).notNull(),       // 0-100
  intensity: decimal('intensity', { precision: 5, scale: 2 }).notNull(),         // 0-100
  weight: varchar('weight', { length: 10 }).notNull().$type<FlavorWeight>(),     // light/medium/heavy
  temperature: varchar('temperature', { length: 10 }).notNull().$type<FlavorTemperature>(), // cool/neutral/warm
  memo: text('memo'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_creator_flavor_notes_creator').on(table.creatorId),
  unique('uq_creator_flavor_notes_creator_flavor').on(table.creatorId, table.flavorId),
]);

// ---------------------------------------------------------------------------
// Prohibited Combinations - 禁止組み合わせ
// ---------------------------------------------------------------------------

export const prohibitedReasonEnum = ['chemical_reaction', 'odor_clash', 'safety', 'aesthetic'] as const;
export type ProhibitedReason = (typeof prohibitedReasonEnum)[number];

export const prohibitedCombinations = pgTable('prohibited_combinations', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull().references(() => users.id),
  flavorAId: uuid('flavor_a_id').notNull().references(() => flavors.id),
  flavorBId: uuid('flavor_b_id').notNull().references(() => flavors.id),
  reason: varchar('reason', { length: 30 }).notNull().$type<ProhibitedReason>(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_prohibited_combinations_creator').on(table.creatorId),
  unique('uq_prohibited_combinations_pair').on(table.creatorId, table.flavorAId, table.flavorBId),
]);

// ---------------------------------------------------------------------------
// Flavor Compatibility - 相性スコア
// ---------------------------------------------------------------------------

export const flavorCompatibility = pgTable('flavor_compatibility', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull().references(() => users.id),
  flavorAId: uuid('flavor_a_id').notNull().references(() => flavors.id),
  flavorBId: uuid('flavor_b_id').notNull().references(() => flavors.id),
  score: decimal('score', { precision: 3, scale: 1 }).notNull(), // -1.0 to +1.0
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_flavor_compatibility_creator').on(table.creatorId),
  unique('uq_flavor_compatibility_pair').on(table.creatorId, table.flavorAId, table.flavorBId),
]);

// ---------------------------------------------------------------------------
// Theme Axes - テーマ軸
// ---------------------------------------------------------------------------

export const themeAxisTypeEnum = ['scene', 'mood', 'worldview', 'relationship'] as const;
export type ThemeAxisType = (typeof themeAxisTypeEnum)[number];

export const themeAxes = pgTable('theme_axes', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull().references(() => users.id),
  type: varchar('type', { length: 20 }).notNull().$type<ThemeAxisType>(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_theme_axes_creator').on(table.creatorId),
  unique('uq_theme_axes_creator_type_name').on(table.creatorId, table.type, table.name),
]);

// ---------------------------------------------------------------------------
// Profile Visitors (Footprints) - あしあと
// ---------------------------------------------------------------------------

export const profileVisitors = pgTable('profile_visitors', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull().references(() => users.id),
  visitorId: uuid('visitor_id').notNull().references(() => users.id),
  visitedAt: timestamp('visited_at').notNull().defaultNow(),
}, (table) => [
  index('idx_profile_visitors_creator').on(table.creatorId),
  index('idx_profile_visitors_visitor').on(table.visitorId),
]);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const creatorFlavorNotesRelations = relations(creatorFlavorNotes, ({ one }) => ({
  creator: one(users, { fields: [creatorFlavorNotes.creatorId], references: [users.id] }),
  flavor: one(flavors, { fields: [creatorFlavorNotes.flavorId], references: [flavors.id] }),
}));

export const prohibitedCombinationsRelations = relations(prohibitedCombinations, ({ one }) => ({
  creator: one(users, { fields: [prohibitedCombinations.creatorId], references: [users.id] }),
  flavorA: one(flavors, { fields: [prohibitedCombinations.flavorAId], references: [flavors.id], relationName: 'prohibitedFlavorA' }),
  flavorB: one(flavors, { fields: [prohibitedCombinations.flavorBId], references: [flavors.id], relationName: 'prohibitedFlavorB' }),
}));

export const flavorCompatibilityRelations = relations(flavorCompatibility, ({ one }) => ({
  creator: one(users, { fields: [flavorCompatibility.creatorId], references: [users.id] }),
  flavorA: one(flavors, { fields: [flavorCompatibility.flavorAId], references: [flavors.id], relationName: 'compatFlavorA' }),
  flavorB: one(flavors, { fields: [flavorCompatibility.flavorBId], references: [flavors.id], relationName: 'compatFlavorB' }),
}));

export const themeAxesRelations = relations(themeAxes, ({ one }) => ({
  creator: one(users, { fields: [themeAxes.creatorId], references: [users.id] }),
}));

export const profileVisitorsRelations = relations(profileVisitors, ({ one }) => ({
  creator: one(users, { fields: [profileVisitors.creatorId], references: [users.id], relationName: 'visitedCreator' }),
  visitor: one(users, { fields: [profileVisitors.visitorId], references: [users.id], relationName: 'visitor' }),
}));
