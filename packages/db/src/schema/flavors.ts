import { pgTable, uuid, varchar, text, integer } from "drizzle-orm/pg-core";

export const noteTypeEnum = ["TOP", "MIDDLE", "LAST"] as const;
export type NoteType = (typeof noteTypeEnum)[number];

export const flavors = pgTable("flavors", {
	id: uuid("id").primaryKey().defaultRandom(),
	nameJa: varchar("name_ja", { length: 100 }).notNull(),
	nameEn: varchar("name_en", { length: 100 }).notNull(),
	noteType: varchar("note_type", { length: 10 }).notNull().$type<NoteType>(),
	description: text("description"),
	sortOrder: integer("sort_order").default(0),
});
