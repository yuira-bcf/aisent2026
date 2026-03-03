import { pgTable, uuid, varchar, text, integer, boolean, timestamp, index, uniqueIndex, decimal } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { blendResults } from './blends';
import { signatureRecipes } from './recipes';

// ---------------------------------------------------------------------------
// Order status enum
// ---------------------------------------------------------------------------

export const orderStatusEnum = ['PENDING', 'CONFIRMED', 'PREPARING', 'MANUFACTURING', 'MANUFACTURED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'] as const;
export type OrderStatus = (typeof orderStatusEnum)[number];

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  priceYen: integer('price_yen').notNull(),
  imageUrl: varchar('image_url', { length: 500 }),
  blendResultId: uuid('blend_result_id').references(() => blendResults.id),
  recipeId: uuid('recipe_id').references(() => signatureRecipes.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Shipping Addresses
// ---------------------------------------------------------------------------

export const shippingAddresses = pgTable('shipping_addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 50 }).notNull(),
  recipientName: varchar('recipient_name', { length: 100 }).notNull(),
  postalCode: varchar('postal_code', { length: 10 }).notNull(),
  prefecture: varchar('prefecture', { length: 20 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  addressLine1: varchar('address_line_1', { length: 200 }).notNull(),
  addressLine2: varchar('address_line_2', { length: 200 }),
  phone: varchar('phone', { length: 20 }).notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_shipping_addresses_user').on(table.userId),
]);

// ---------------------------------------------------------------------------
// Cart Items
// ---------------------------------------------------------------------------

export const cartItems = pgTable('cart_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_cart_items_user').on(table.userId),
]);

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  status: varchar('status', { length: 20 }).notNull().default('PENDING').$type<OrderStatus>(),
  totalYen: integer('total_yen').notNull(),
  discountYen: integer('discount_yen').notNull().default(0),
  stripeSessionId: varchar('stripe_session_id', { length: 255 }),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  // Shipping address snapshot
  shippingRecipientName: varchar('shipping_recipient_name', { length: 100 }).notNull(),
  shippingPostalCode: varchar('shipping_postal_code', { length: 10 }).notNull(),
  shippingPrefecture: varchar('shipping_prefecture', { length: 20 }).notNull(),
  shippingCity: varchar('shipping_city', { length: 100 }).notNull(),
  shippingAddressLine1: varchar('shipping_address_line_1', { length: 200 }).notNull(),
  shippingAddressLine2: varchar('shipping_address_line_2', { length: 200 }),
  shippingPhone: varchar('shipping_phone', { length: 20 }).notNull(),
  cancelledAt: timestamp('cancelled_at'),
  cancelReason: varchar('cancel_reason', { length: 30 }),
  cancelDetail: text('cancel_detail'),
  deliveredAt: timestamp('delivered_at'),
  receiptIssuedAt: timestamp('receipt_issued_at'),
  receiptCount: integer('receipt_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_orders_user').on(table.userId),
  index('idx_orders_status').on(table.status),
]);

// ---------------------------------------------------------------------------
// Order Items
// ---------------------------------------------------------------------------

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  productName: varchar('product_name', { length: 200 }).notNull(),
  priceYen: integer('price_yen').notNull(),
  quantity: integer('quantity').notNull(),
}, (table) => [
  index('idx_order_items_order').on(table.orderId),
]);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const productsRelations = relations(products, ({ one }) => ({
  blendResult: one(blendResults, { fields: [products.blendResultId], references: [blendResults.id] }),
  recipe: one(signatureRecipes, { fields: [products.recipeId], references: [signatureRecipes.id] }),
}));

export const shippingAddressesRelations = relations(shippingAddresses, ({ one }) => ({
  user: one(users, { fields: [shippingAddresses.userId], references: [users.id] }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  user: one(users, { fields: [cartItems.userId], references: [users.id] }),
  product: one(products, { fields: [cartItems.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

// ---------------------------------------------------------------------------
// Product Favorites
// ---------------------------------------------------------------------------

export const productFavorites = pgTable('product_favorites', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_product_favorites_user_product').on(table.userId, table.productId),
]);

export const productFavoritesRelations = relations(productFavorites, ({ one }) => ({
  user: one(users, { fields: [productFavorites.userId], references: [users.id] }),
  product: one(products, { fields: [productFavorites.productId], references: [products.id] }),
}));
