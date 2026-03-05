import { relations } from "drizzle-orm";
import {
	boolean,
	decimal,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

// ---------------------------------------------------------------------------
// Creator Profiles (クリエータープロフィール)
// ---------------------------------------------------------------------------

export const creatorProfiles = pgTable(
	"creator_profiles",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.unique()
			.references(() => users.id, { onDelete: "cascade" }),
		displayName: varchar("display_name", { length: 100 }).notNull(),
		creatorIdSlug: varchar("creator_id_slug", { length: 20 })
			.notNull()
			.unique(),
		bio: text("bio"),
		avatarUrl: varchar("avatar_url", { length: 500 }),
		specialties: jsonb("specialties").$type<string[]>(),
		styleDescription: text("style_description"),
		stylePrompt: text("style_prompt"),
		styleNoteBalance:
			jsonb("style_note_balance").$type<Record<string, number>>(),
		styleFlavorPreferences: jsonb("style_flavor_preferences").$type<
			Record<string, number>
		>(),
		websiteUrl: varchar("website_url", { length: 500 }),
		socialLinks: jsonb("social_links").$type<Record<string, string>>(),
		isActive: boolean("is_active").notNull().default(true),
		approvedAt: timestamp("approved_at"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		index("idx_creator_profiles_user").on(table.userId),
		index("idx_creator_profiles_slug").on(table.creatorIdSlug),
		index("idx_creator_profiles_active").on(table.isActive),
	],
);

// ---------------------------------------------------------------------------
// Creator Stats (クリエーター統計・ティア)
// ---------------------------------------------------------------------------

export const tierEnum = [
	"APPRENTICE",
	"ARTISAN",
	"EXPERT",
	"MASTER",
	"GRAND_MASTER",
] as const;
export type Tier = (typeof tierEnum)[number];

export const creatorStats = pgTable(
	"creator_stats",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.unique()
			.references(() => users.id, { onDelete: "cascade" }),
		tier: varchar("tier", { length: 20 })
			.notNull()
			.default("APPRENTICE")
			.$type<Tier>(),
		tierScore: decimal("tier_score", { precision: 10, scale: 2 })
			.notNull()
			.default("0"),
		recipeSalesCount: integer("recipe_sales_count").notNull().default(0),
		recipeReviewCount: integer("recipe_review_count").notNull().default(0),
		avgRating: decimal("avg_rating", { precision: 3, scale: 2 })
			.notNull()
			.default("0.00"),
		repeatRate: decimal("repeat_rate", { precision: 5, scale: 2 })
			.notNull()
			.default("0.00"),
		favoriteCount: integer("favorite_count").notNull().default(0),
		monthsBelowThreshold: integer("months_below_threshold")
			.notNull()
			.default(0),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [index("idx_creator_stats_user").on(table.userId)],
);

// ---------------------------------------------------------------------------
// Creator Favorites (お気に入りクリエーター)
// ---------------------------------------------------------------------------

export const creatorFavorites = pgTable(
	"creator_favorites",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		creatorId: uuid("creator_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("idx_creator_favorites_user_creator").on(
			table.userId,
			table.creatorId,
		),
		index("idx_creator_favorites_user").on(table.userId),
		index("idx_creator_favorites_creator").on(table.creatorId),
	],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const creatorProfilesRelations = relations(
	creatorProfiles,
	({ one }) => ({
		user: one(users, {
			fields: [creatorProfiles.userId],
			references: [users.id],
		}),
	}),
);

export const creatorStatsRelations = relations(creatorStats, ({ one }) => ({
	user: one(users, { fields: [creatorStats.userId], references: [users.id] }),
}));

export const creatorFavoritesRelations = relations(
	creatorFavorites,
	({ one }) => ({
		user: one(users, {
			fields: [creatorFavorites.userId],
			references: [users.id],
		}),
		creator: one(users, {
			fields: [creatorFavorites.creatorId],
			references: [users.id],
		}),
	}),
);
