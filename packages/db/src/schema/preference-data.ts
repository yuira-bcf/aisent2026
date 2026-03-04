import { relations } from "drizzle-orm";
import {
	decimal,
	integer,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { flavors } from "./flavors";
import { users } from "./users";

export const flavorPreferences = pgTable(
	"flavor_preferences",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id),
		flavorId: uuid("flavor_id")
			.notNull()
			.references(() => flavors.id),
		score: decimal("score", { precision: 5, scale: 2 }).notNull(),
		blendCount: integer("blend_count").notNull().default(0),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("uq_flavor_preferences_user_flavor").on(
			table.userId,
			table.flavorId,
		),
	],
);

export const flavorPreferencesRelations = relations(
	flavorPreferences,
	({ one }) => ({
		user: one(users, {
			fields: [flavorPreferences.userId],
			references: [users.id],
		}),
		flavor: one(flavors, {
			fields: [flavorPreferences.flavorId],
			references: [flavors.id],
		}),
	}),
);
