import { jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const roleEnum = ["CUSTOMER", "CREATOR", "ADMIN"] as const;
export type Role = (typeof roleEnum)[number];

export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(),
	email: varchar("email", { length: 255 }).notNull().unique(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	name: varchar("name", { length: 100 }).notNull(),
	role: varchar("role", { length: 20 })
		.notNull()
		.default("CUSTOMER")
		.$type<Role>(),
	tastePreferences: jsonb("taste_preferences").$type<{
		category: string;
		axes: Record<string, number>;
	}>(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});
