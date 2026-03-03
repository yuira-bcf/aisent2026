import { pgTable, uuid, varchar, decimal, boolean, text, timestamp, integer, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { flavors } from './flavors';
import { orders } from './commerce';
import type { NoteType } from './flavors';

// ---------------------------------------------------------------------------
// Recipe status enum
// ---------------------------------------------------------------------------

export const recipeStatusEnum = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type RecipeStatus = (typeof recipeStatusEnum)[number];

// ---------------------------------------------------------------------------
// Signature Recipes
// ---------------------------------------------------------------------------

export const signatureRecipes = pgTable('signature_recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull().references(() => users.id),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  concept: text('concept'),                // コンセプト文
  scene: varchar('scene', { length: 30 }),          // シーン(デート, 仕事等)
  mood: varchar('mood', { length: 30 }),            // ムード(爽やか, 甘い等)
  themeId: varchar('theme_id', { length: 50 }),     // テーマ(デート, リラックス等)
  subTheme: varchar('sub_theme', { length: 50 }),   // サブテーマ(爽やか, 甘い等)
  topRatio: decimal('top_ratio', { precision: 5, scale: 2 }).notNull(),       // TOP比率
  middleRatio: decimal('middle_ratio', { precision: 5, scale: 2 }).notNull(), // MIDDLE比率
  lastRatio: decimal('last_ratio', { precision: 5, scale: 2 }).notNull(),     // LAST比率
  status: varchar('status', { length: 20 }).notNull().default('DRAFT').$type<RecipeStatus>(),
  price30ml: integer('price_30ml'),          // 30ml価格(円)
  price50ml: integer('price_50ml'),          // 50ml価格(円)
  orderCount: integer('order_count').notNull().default(0),
  totalRevenue: integer('total_revenue').notNull().default(0),
  version: integer('version').notNull().default(1),
  imageUrl: varchar('image_url', { length: 500 }),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => [
  index('idx_signature_recipes_creator').on(table.creatorId),
  index('idx_signature_recipes_status').on(table.status),
  index('idx_signature_recipes_theme').on(table.themeId),
]);

// ---------------------------------------------------------------------------
// Recipe Flavors (配合する個別香料)
// ---------------------------------------------------------------------------

export const recipeFlavors = pgTable('recipe_flavors', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id').notNull().references(() => signatureRecipes.id, { onDelete: 'cascade' }),
  flavorId: uuid('flavor_id').notNull().references(() => flavors.id),
  ratio: decimal('ratio', { precision: 5, scale: 2 }).notNull(),          // 配合比率(%)
  noteType: varchar('note_type', { length: 10 }).notNull().$type<NoteType>(),  // TOP/MIDDLE/LAST
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_recipe_flavors_recipe').on(table.recipeId),
  index('idx_recipe_flavors_flavor').on(table.flavorId),
  unique('uq_recipe_flavors_recipe_flavor').on(table.recipeId, table.flavorId),
]);

// ---------------------------------------------------------------------------
// Recipe Stats (集計統計)
// ---------------------------------------------------------------------------

export const recipeStats = pgTable('recipe_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id').notNull().references(() => signatureRecipes.id, { onDelete: 'cascade' }).unique(),
  salesCount: integer('sales_count').notNull().default(0),
  reviewCount: integer('review_count').notNull().default(0),
  avgRating: decimal('avg_rating', { precision: 3, scale: 2 }).notNull().default('0.00'),
  favoriteCount: integer('favorite_count').notNull().default(0),
  totalRevenue: integer('total_revenue').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Recipe Reviews
// ---------------------------------------------------------------------------

export const recipeReviews = pgTable('recipe_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id').notNull().references(() => signatureRecipes.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  orderId: uuid('order_id').references(() => orders.id),  // nullable - 注文に紐づくレビュー
  rating: integer('rating').notNull(),       // 1-5
  title: varchar('title', { length: 200 }),
  comment: text('comment'),
  isVerifiedPurchase: boolean('is_verified_purchase').notNull().default(false),
  helpfulCount: integer('helpful_count').notNull().default(0),
  isVisible: boolean('is_visible').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_recipe_reviews_recipe').on(table.recipeId),
  index('idx_recipe_reviews_user').on(table.userId),
  unique('uq_recipe_reviews_recipe_user').on(table.recipeId, table.userId),
]);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const signatureRecipesRelations = relations(signatureRecipes, ({ one, many }) => ({
  creator: one(users, { fields: [signatureRecipes.creatorId], references: [users.id] }),
  flavors: many(recipeFlavors),
  reviews: many(recipeReviews),
  stats: one(recipeStats),
}));

export const recipeFlavorsRelations = relations(recipeFlavors, ({ one }) => ({
  recipe: one(signatureRecipes, { fields: [recipeFlavors.recipeId], references: [signatureRecipes.id] }),
  flavor: one(flavors, { fields: [recipeFlavors.flavorId], references: [flavors.id] }),
}));

export const recipeStatsRelations = relations(recipeStats, ({ one }) => ({
  recipe: one(signatureRecipes, { fields: [recipeStats.recipeId], references: [signatureRecipes.id] }),
}));

export const recipeReviewsRelations = relations(recipeReviews, ({ one }) => ({
  recipe: one(signatureRecipes, { fields: [recipeReviews.recipeId], references: [signatureRecipes.id] }),
  user: one(users, { fields: [recipeReviews.userId], references: [users.id] }),
  order: one(orders, { fields: [recipeReviews.orderId], references: [orders.id] }),
}));
