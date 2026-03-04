import {
	pgTable,
	uuid,
	varchar,
	text,
	boolean,
	timestamp,
	index,
	jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

// ---------------------------------------------------------------------------
// Notification type enum
// ---------------------------------------------------------------------------

export const notificationTypeEnum = [
	"ORDER_CONFIRMED",
	"ORDER_SHIPPED",
	"ORDER_DELIVERED",
	"ORDER_CANCELLED",
	"REVIEW_RECEIVED",
	"RECIPE_ORDERED",
	"ROYALTY_PAID",
	"TIER_CHANGED",
	"SYSTEM_ANNOUNCEMENT",
	"CREATOR_APPROVED",
	"CREATOR_REJECTED",
] as const;
export type NotificationType = (typeof notificationTypeEnum)[number];

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications = pgTable(
	"notifications",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		type: varchar("type", { length: 50 }).notNull().$type<NotificationType>(),
		title: varchar("title", { length: 200 }).notNull(),
		body: text("body"),
		data: jsonb("data").$type<Record<string, unknown>>(),
		isRead: boolean("is_read").notNull().default(false),
		readAt: timestamp("read_at"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		index("idx_notifications_user_created").on(table.userId, table.createdAt),
		index("idx_notifications_user_is_read").on(table.userId, table.isRead),
	],
);

// ---------------------------------------------------------------------------
// Notification Preferences
// ---------------------------------------------------------------------------

export const notificationPreferences = pgTable("notification_preferences", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" })
		.unique(),
	emailOrderUpdates: boolean("email_order_updates").notNull().default(true),
	emailReviews: boolean("email_reviews").notNull().default(true),
	emailRoyalty: boolean("email_royalty").notNull().default(true),
	emailSystem: boolean("email_system").notNull().default(true),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const notificationsRelations = relations(notifications, ({ one }) => ({
	user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const notificationPreferencesRelations = relations(
	notificationPreferences,
	({ one }) => ({
		user: one(users, {
			fields: [notificationPreferences.userId],
			references: [users.id],
		}),
	}),
);
