import { relations } from "drizzle-orm";
import {
	boolean,
	decimal,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { flavors } from "./flavors";
import { users } from "./users";

// ---------------------------------------------------------------------------
// Creator Profiles (クリエーターの拡張プロフィール)
// ---------------------------------------------------------------------------

export const creatorProfiles = pgTable(
	"creator_profiles_legacy",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.unique()
			.references(() => users.id),
		displayName: varchar("display_name", { length: 100 }).notNull(),
		bio: text("bio"),
		specialty: varchar("specialty", { length: 200 }), // 得意分野テキスト
		avatarUrl: varchar("avatar_url", { length: 500 }),
		tier: varchar("tier", { length: 20 }).notNull().default("APPRENTICE"), // APPRENTICE/ARTISAN/EXPERT/MASTER/GRAND_MASTER
		isVerified: boolean("is_verified").notNull().default(false),
		recipeCount: integer("recipe_count").notNull().default(0),
		publishedRecipeCount: integer("published_recipe_count")
			.notNull()
			.default(0),
		totalSales: integer("total_sales").notNull().default(0), // 累計売上(円)
		averageRating: decimal("average_rating", {
			precision: 3,
			scale: 2,
		}).default("0"),
		reviewCount: integer("review_count").notNull().default(0),
		repeatRate: decimal("repeat_rate", { precision: 5, scale: 2 }).default("0"), // リピート率(%)
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		index("idx_creator_profiles_tier").on(table.tier),
		index("idx_creator_profiles_verified").on(table.isVerified),
	],
);

// ---------------------------------------------------------------------------
// Creator Styles (調合スタイルプロファイル)
// ---------------------------------------------------------------------------

export const creatorStyles = pgTable("creator_styles", {
	id: uuid("id").primaryKey().defaultRandom(),
	creatorId: uuid("creator_id")
		.notNull()
		.unique()
		.references(() => users.id),
	topBias: decimal("top_bias", { precision: 3, scale: 2 })
		.notNull()
		.default("0"), // TOP傾向 (-1.0 〜 +1.0)
	middleBias: decimal("middle_bias", { precision: 3, scale: 2 })
		.notNull()
		.default("0"), // MIDDLE傾向
	lastBias: decimal("last_bias", { precision: 3, scale: 2 })
		.notNull()
		.default("0"), // LAST傾向
	styleDescription: text("style_description"), // スタイル説明(公開用)
	aiInstruction: text("ai_instruction"), // AIへの指示(内部用)
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Creator Style Flavor Prefs (香料ブースト/抑制)
// ---------------------------------------------------------------------------

export const creatorStyleFlavorPrefs = pgTable(
	"creator_style_flavor_prefs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		styleId: uuid("style_id")
			.notNull()
			.references(() => creatorStyles.id, { onDelete: "cascade" }),
		flavorId: uuid("flavor_id")
			.notNull()
			.references(() => flavors.id),
		boost: decimal("boost", { precision: 3, scale: 2 }).notNull(), // +0.3 = ブースト, -0.2 = 抑制
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [index("idx_creator_style_flavor_prefs_style").on(table.styleId)],
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

export const creatorStylesRelations = relations(
	creatorStyles,
	({ one, many }) => ({
		creator: one(users, {
			fields: [creatorStyles.creatorId],
			references: [users.id],
		}),
		flavorPrefs: many(creatorStyleFlavorPrefs),
	}),
);

export const creatorStyleFlavorPrefsRelations = relations(
	creatorStyleFlavorPrefs,
	({ one }) => ({
		style: one(creatorStyles, {
			fields: [creatorStyleFlavorPrefs.styleId],
			references: [creatorStyles.id],
		}),
		flavor: one(flavors, {
			fields: [creatorStyleFlavorPrefs.flavorId],
			references: [flavors.id],
		}),
	}),
);
