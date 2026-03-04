import {
	pgTable,
	uuid,
	varchar,
	integer,
	boolean,
	timestamp,
	index,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { orders } from "./commerce";

export const discountTypeEnum = ["FIXED", "PERCENT"] as const;
export type DiscountType = (typeof discountTypeEnum)[number];

export const coupons = pgTable(
	"coupons",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		code: varchar("code", { length: 50 }).notNull().unique(),
		discountType: varchar("discount_type", { length: 10 })
			.notNull()
			.$type<DiscountType>(),
		discountValue: integer("discount_value").notNull(), // Yen for FIXED, percentage for PERCENT
		minOrderYen: integer("min_order_yen").notNull().default(0),
		maxUses: integer("max_uses"), // null = unlimited
		usedCount: integer("used_count").notNull().default(0),
		validFrom: timestamp("valid_from").notNull().defaultNow(),
		validUntil: timestamp("valid_until"),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [index("idx_coupons_code").on(table.code)],
);

export const couponUsages = pgTable(
	"coupon_usages",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		couponId: uuid("coupon_id")
			.notNull()
			.references(() => coupons.id),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id),
		orderId: uuid("order_id")
			.notNull()
			.references(() => orders.id),
		discountYen: integer("discount_yen").notNull(),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		index("idx_coupon_usages_coupon").on(table.couponId),
		index("idx_coupon_usages_user").on(table.userId),
	],
);

export const couponsRelations = relations(coupons, ({ many }) => ({
	usages: many(couponUsages),
}));

export const couponUsagesRelations = relations(couponUsages, ({ one }) => ({
	coupon: one(coupons, {
		fields: [couponUsages.couponId],
		references: [coupons.id],
	}),
	user: one(users, { fields: [couponUsages.userId], references: [users.id] }),
	order: one(orders, {
		fields: [couponUsages.orderId],
		references: [orders.id],
	}),
}));
