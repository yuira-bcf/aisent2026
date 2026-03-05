import {
	boolean,
	decimal,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// AI Blend Rule types
// ---------------------------------------------------------------------------

export const ruleTypeEnum = [
	"weight_limit",
	"ratio_constraint",
	"compatibility",
	"note_balance",
] as const;
export type RuleType = (typeof ruleTypeEnum)[number];

// ---------------------------------------------------------------------------
// AI Blend Rules
// ---------------------------------------------------------------------------

export const aiBlendRules = pgTable("ai_blend_rules", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: varchar("name", { length: 100 }).notNull(),
	description: text("description"),
	ruleType: varchar("rule_type", { length: 30 }).notNull().$type<RuleType>(),
	parameter: jsonb("parameter"),
	isActive: boolean("is_active").notNull().default(true),
	priority: integer("priority").notNull().default(0),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// EC Settings (singleton-like, single row)
// ---------------------------------------------------------------------------

export const ecSettings = pgTable("ec_settings", {
	id: uuid("id").primaryKey().defaultRandom(),
	shippingFeeYen: integer("shipping_fee_yen").notNull().default(0),
	taxRate: decimal("tax_rate", { precision: 5, scale: 2 })
		.notNull()
		.default("10.0"),
	freeShippingThresholdYen: integer("free_shipping_threshold_yen")
		.notNull()
		.default(5000),
	paymentProvider: varchar("payment_provider", { length: 30 })
		.notNull()
		.default("stripe"),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// AI Calibration Parameter types
// ---------------------------------------------------------------------------

export const calibrationCategoryEnum = [
	"blend_weight",
	"note_ratio",
	"keyword_influence",
	"flavor_selection",
] as const;
export type CalibrationCategory = (typeof calibrationCategoryEnum)[number];

// ---------------------------------------------------------------------------
// AI Calibration Parameters
// ---------------------------------------------------------------------------

export const aiCalibrationParams = pgTable("ai_calibration_params", {
	id: uuid("id").primaryKey().defaultRandom(),
	paramName: varchar("param_name", { length: 100 }).notNull(),
	paramValue: decimal("param_value", { precision: 10, scale: 4 }).notNull(),
	description: text("description"),
	category: varchar("category", { length: 30 })
		.notNull()
		.$type<CalibrationCategory>(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
