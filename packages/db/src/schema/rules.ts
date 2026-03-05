import { relations } from "drizzle-orm";
import {
	decimal,
	index,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { flavors } from "./flavors";
import type { NoteType } from "./flavors";
import { keywords } from "./keywords";
import { users } from "./users";

export const keywordFlavorRules = pgTable(
	"keyword_flavor_rules",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		keywordId: uuid("keyword_id")
			.notNull()
			.references(() => keywords.id, { onDelete: "cascade" }),
		flavorId: uuid("flavor_id")
			.notNull()
			.references(() => flavors.id, { onDelete: "cascade" }),
		weight: decimal("weight", { precision: 5, scale: 4 }).notNull(),
		noteType: varchar("note_type", { length: 10 }).notNull().$type<NoteType>(),
		creatorId: uuid("creator_id").references(() => users.id), // NULL = ベースAIルール
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		index("idx_keyword_flavor_rules_keyword").on(table.keywordId),
		index("idx_keyword_flavor_rules_flavor").on(table.flavorId),
	],
);

export const keywordFlavorRulesRelations = relations(
	keywordFlavorRules,
	({ one }) => ({
		keyword: one(keywords, {
			fields: [keywordFlavorRules.keywordId],
			references: [keywords.id],
		}),
		flavor: one(flavors, {
			fields: [keywordFlavorRules.flavorId],
			references: [flavors.id],
		}),
		creator: one(users, {
			fields: [keywordFlavorRules.creatorId],
			references: [users.id],
		}),
	}),
);
