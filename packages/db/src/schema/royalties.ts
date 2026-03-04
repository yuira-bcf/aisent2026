import { relations } from "drizzle-orm";
import {
	decimal,
	index,
	integer,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { orders } from "./commerce";
import { users } from "./users";

// ---------------------------------------------------------------------------
// Royalty status
// ---------------------------------------------------------------------------

export const royaltyStatusEnum = ["PENDING", "PAID"] as const;
export type RoyaltyStatus = (typeof royaltyStatusEnum)[number];

// ---------------------------------------------------------------------------
// Royalties (ロイヤリティ)
// ---------------------------------------------------------------------------

export const royalties = pgTable(
	"royalties",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		creatorId: uuid("creator_id")
			.notNull()
			.references(() => users.id),
		orderId: uuid("order_id")
			.notNull()
			.references(() => orders.id),
		amount: integer("amount").notNull(), // ロイヤリティ金額 (円)
		rate: decimal("rate", { precision: 5, scale: 4 }).notNull(), // ロイヤリティ率 (例: 0.1000)
		status: varchar("status", { length: 20 })
			.notNull()
			.default("PENDING")
			.$type<RoyaltyStatus>(),
		period: varchar("period", { length: 7 }).notNull(), // YYYY-MM
		paidAt: timestamp("paid_at"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		index("idx_royalties_creator").on(table.creatorId),
		index("idx_royalties_order").on(table.orderId),
		index("idx_royalties_period").on(table.period),
		index("idx_royalties_status").on(table.status),
	],
);

// ---------------------------------------------------------------------------
// Platform Settings (プラットフォーム設定)
// ---------------------------------------------------------------------------

export const platformSettings = pgTable("platform_settings", {
	id: uuid("id").primaryKey().defaultRandom(),
	key: varchar("key", { length: 50 }).notNull().unique(),
	value: varchar("value", { length: 500 }).notNull(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const royaltiesRelations = relations(royalties, ({ one }) => ({
	creator: one(users, {
		fields: [royalties.creatorId],
		references: [users.id],
	}),
	order: one(orders, { fields: [royalties.orderId], references: [orders.id] }),
}));
