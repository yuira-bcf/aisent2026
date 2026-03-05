import { relations } from "drizzle-orm";
import {
	boolean,
	decimal,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { blendResults } from "./blends";
import { recipeReviews, signatureRecipes } from "./recipes";
import { users } from "./users";

// ---------------------------------------------------------------------------
// Order status enum
// ---------------------------------------------------------------------------

export const orderStatusEnum = [
	"PENDING",
	"CONFIRMED",
	"PREPARING",
	"MANUFACTURING",
	"MANUFACTURED",
	"SHIPPED",
	"DELIVERED",
	"CANCELLED",
	"RETURNED",
] as const;
export type OrderStatus = (typeof orderStatusEnum)[number];

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export const products = pgTable(
	"products",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: varchar("name", { length: 200 }).notNull(),
		description: text("description"),
		priceYen: integer("price_yen").notNull(), // Min variant price cache
		imageUrl: varchar("image_url", { length: 500 }),
		blendResultId: uuid("blend_result_id").references(() => blendResults.id),
		recipeId: uuid("recipe_id").references(() => signatureRecipes.id),
		creatorId: uuid("creator_id").references(() => users.id),
		isActive: boolean("is_active").notNull().default(true),
		// Extended fields
		intensity: varchar("intensity", { length: 20 }),
		giftWrappingAvailable: boolean("gift_wrapping_available")
			.notNull()
			.default(false),
		isLimited: boolean("is_limited").notNull().default(false),
		manufacturingDays: integer("manufacturing_days").notNull().default(5),
		averageRating: decimal("average_rating", {
			precision: 3,
			scale: 2,
		}).default("0.00"),
		reviewCount: integer("review_count").notNull().default(0),
		salesCount: integer("sales_count").notNull().default(0),
		favoriteCount: integer("favorite_count").notNull().default(0),
		aiStory: text("ai_story"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => [
		index("idx_products_creator").on(table.creatorId),
		index("idx_products_recipe").on(table.recipeId),
		index("idx_products_active").on(table.isActive),
		index("idx_products_created_at").on(table.createdAt),
	],
);

// ---------------------------------------------------------------------------
// Product Variants (volume-based SKUs)
// ---------------------------------------------------------------------------

export const productVariants = pgTable(
	"product_variants",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		productId: uuid("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),
		volume: integer("volume").notNull(), // 10, 30, 50, 100 (ml)
		price: integer("price").notNull(), // Tax-included price (JPY)
		salePrice: integer("sale_price"),
		saleStartAt: timestamp("sale_start_at"),
		saleEndAt: timestamp("sale_end_at"),
		sku: varchar("sku", { length: 50 }).notNull().unique(),
		stock: integer("stock").notNull().default(0),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [index("idx_product_variants_product").on(table.productId)],
);

// ---------------------------------------------------------------------------
// Product Tags (season / scene / feature)
// ---------------------------------------------------------------------------

export const tagTypeEnum = ["season", "scene", "feature"] as const;
export type TagType = (typeof tagTypeEnum)[number];

export const productTags = pgTable(
	"product_tags",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		productId: uuid("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),
		type: varchar("type", { length: 20 }).notNull().$type<TagType>(),
		value: varchar("value", { length: 50 }).notNull(),
	},
	(table) => [
		uniqueIndex("idx_product_tags_unique").on(
			table.productId,
			table.type,
			table.value,
		),
		index("idx_product_tags_product").on(table.productId),
		index("idx_product_tags_type_value").on(table.type, table.value),
	],
);

// ---------------------------------------------------------------------------
// Product Images (gallery)
// ---------------------------------------------------------------------------

export const productImages = pgTable(
	"product_images",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		productId: uuid("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),
		url: text("url").notNull(),
		alt: varchar("alt", { length: 200 }),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [index("idx_product_images_product").on(table.productId)],
);

// ---------------------------------------------------------------------------
// Review Votes ("helpful" votes)
// ---------------------------------------------------------------------------

export const reviewVotes = pgTable(
	"review_votes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		reviewId: uuid("review_id")
			.notNull()
			.references(() => recipeReviews.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("idx_review_votes_unique").on(table.reviewId, table.userId),
	],
);

// ---------------------------------------------------------------------------
// Shipping Addresses
// ---------------------------------------------------------------------------

export const shippingAddresses = pgTable(
	"shipping_addresses",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		label: varchar("label", { length: 50 }).notNull(),
		recipientName: varchar("recipient_name", { length: 100 }).notNull(),
		postalCode: varchar("postal_code", { length: 10 }).notNull(),
		prefecture: varchar("prefecture", { length: 20 }).notNull(),
		city: varchar("city", { length: 100 }).notNull(),
		addressLine1: varchar("address_line_1", { length: 200 }).notNull(),
		addressLine2: varchar("address_line_2", { length: 200 }),
		phone: varchar("phone", { length: 20 }).notNull(),
		isDefault: boolean("is_default").notNull().default(false),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [index("idx_shipping_addresses_user").on(table.userId)],
);

// ---------------------------------------------------------------------------
// Cart Items
// ---------------------------------------------------------------------------

export const cartItems = pgTable(
	"cart_items",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		productId: uuid("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),
		variantId: uuid("variant_id").references(() => productVariants.id, {
			onDelete: "cascade",
		}),
		quantity: integer("quantity").notNull().default(1),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [index("idx_cart_items_user").on(table.userId)],
);

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const orders = pgTable(
	"orders",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id),
		status: varchar("status", { length: 20 })
			.notNull()
			.default("PENDING")
			.$type<OrderStatus>(),
		totalYen: integer("total_yen").notNull(),
		discountYen: integer("discount_yen").notNull().default(0),
		stripeSessionId: varchar("stripe_session_id", { length: 255 }),
		stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
		// Shipping address snapshot
		shippingRecipientName: varchar("shipping_recipient_name", {
			length: 100,
		}).notNull(),
		shippingPostalCode: varchar("shipping_postal_code", {
			length: 10,
		}).notNull(),
		shippingPrefecture: varchar("shipping_prefecture", {
			length: 20,
		}).notNull(),
		shippingCity: varchar("shipping_city", { length: 100 }).notNull(),
		shippingAddressLine1: varchar("shipping_address_line_1", {
			length: 200,
		}).notNull(),
		shippingAddressLine2: varchar("shipping_address_line_2", { length: 200 }),
		shippingPhone: varchar("shipping_phone", { length: 20 }).notNull(),
		cancelledAt: timestamp("cancelled_at"),
		cancelReason: varchar("cancel_reason", { length: 30 }),
		cancelDetail: text("cancel_detail"),
		deliveredAt: timestamp("delivered_at"),
		receiptIssuedAt: timestamp("receipt_issued_at"),
		receiptCount: integer("receipt_count").notNull().default(0),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		index("idx_orders_user").on(table.userId),
		index("idx_orders_status").on(table.status),
	],
);

// ---------------------------------------------------------------------------
// Order Items
// ---------------------------------------------------------------------------

export const orderItems = pgTable(
	"order_items",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "cascade" }),
		productId: uuid("product_id")
			.notNull()
			.references(() => products.id),
		productName: varchar("product_name", { length: 200 }).notNull(),
		priceYen: integer("price_yen").notNull(),
		quantity: integer("quantity").notNull(),
		// Variant snapshot
		variantId: uuid("variant_id").references(() => productVariants.id),
		volume: integer("volume"),
		sku: varchar("sku", { length: 50 }),
	},
	(table) => [index("idx_order_items_order").on(table.orderId)],
);

// ---------------------------------------------------------------------------
// Product Favorites
// ---------------------------------------------------------------------------

export const productFavorites = pgTable(
	"product_favorites",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		productId: uuid("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("idx_product_favorites_user_product").on(
			table.userId,
			table.productId,
		),
	],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const productsRelations = relations(products, ({ one, many }) => ({
	blendResult: one(blendResults, {
		fields: [products.blendResultId],
		references: [blendResults.id],
	}),
	recipe: one(signatureRecipes, {
		fields: [products.recipeId],
		references: [signatureRecipes.id],
	}),
	creator: one(users, {
		fields: [products.creatorId],
		references: [users.id],
	}),
	variants: many(productVariants),
	tags: many(productTags),
	images: many(productImages),
}));

export const productVariantsRelations = relations(
	productVariants,
	({ one }) => ({
		product: one(products, {
			fields: [productVariants.productId],
			references: [products.id],
		}),
	}),
);

export const productTagsRelations = relations(productTags, ({ one }) => ({
	product: one(products, {
		fields: [productTags.productId],
		references: [products.id],
	}),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
	product: one(products, {
		fields: [productImages.productId],
		references: [products.id],
	}),
}));

export const reviewVotesRelations = relations(reviewVotes, ({ one }) => ({
	review: one(recipeReviews, {
		fields: [reviewVotes.reviewId],
		references: [recipeReviews.id],
	}),
	user: one(users, {
		fields: [reviewVotes.userId],
		references: [users.id],
	}),
}));

export const shippingAddressesRelations = relations(
	shippingAddresses,
	({ one }) => ({
		user: one(users, {
			fields: [shippingAddresses.userId],
			references: [users.id],
		}),
	}),
);

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
	user: one(users, { fields: [cartItems.userId], references: [users.id] }),
	product: one(products, {
		fields: [cartItems.productId],
		references: [products.id],
	}),
	variant: one(productVariants, {
		fields: [cartItems.variantId],
		references: [productVariants.id],
	}),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
	user: one(users, { fields: [orders.userId], references: [users.id] }),
	items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
	order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
	product: one(products, {
		fields: [orderItems.productId],
		references: [products.id],
	}),
	variant: one(productVariants, {
		fields: [orderItems.variantId],
		references: [productVariants.id],
	}),
}));

export const productFavoritesRelations = relations(
	productFavorites,
	({ one }) => ({
		user: one(users, {
			fields: [productFavorites.userId],
			references: [users.id],
		}),
		product: one(products, {
			fields: [productFavorites.productId],
			references: [products.id],
		}),
	}),
);
