CREATE TABLE "ai_blend_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"rule_type" varchar(30) NOT NULL,
	"parameter" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_calibration_params" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"param_name" varchar(100) NOT NULL,
	"param_value" numeric(10, 4) NOT NULL,
	"description" text,
	"category" varchar(30) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(50) NOT NULL,
	"resource" varchar(50) NOT NULL,
	"resource_id" uuid,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blend_request_flavors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blend_request_id" uuid NOT NULL,
	"flavor_id" uuid NOT NULL,
	"ratio" numeric(5, 2) NOT NULL,
	"note_type" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blend_request_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blend_request_id" uuid NOT NULL,
	"keyword_id" uuid NOT NULL,
	"weight" numeric(3, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blend_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"creator_id" uuid,
	"top_ratio" numeric(5, 2) NOT NULL,
	"middle_ratio" numeric(5, 2) NOT NULL,
	"last_ratio" numeric(5, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"manual_blend" boolean DEFAULT false NOT NULL,
	"name" varchar(100),
	"parent_blend_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blend_result_flavors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blend_result_id" uuid NOT NULL,
	"flavor_id" uuid NOT NULL,
	"ratio" numeric(5, 2) NOT NULL,
	"note_type" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blend_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blend_request_id" uuid NOT NULL,
	"story" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blend_results_blend_request_id_unique" UNIQUE("blend_request_id")
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"discount_yen" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"discount_type" varchar(10) NOT NULL,
	"discount_value" integer NOT NULL,
	"min_order_yen" integer DEFAULT 0 NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "creator_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"creator_id_slug" varchar(20) NOT NULL,
	"bio" text NOT NULL,
	"specialties" jsonb NOT NULL,
	"portfolio_description" text,
	"motivation" text NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"rejection_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_flavor_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"flavor_id" uuid NOT NULL,
	"volatility" numeric(5, 2) NOT NULL,
	"intensity" numeric(5, 2) NOT NULL,
	"weight" varchar(10) NOT NULL,
	"temperature" varchar(10) NOT NULL,
	"memo" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_creator_flavor_notes_creator_flavor" UNIQUE("creator_id","flavor_id")
);
--> statement-breakpoint
CREATE TABLE "creator_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"creator_id_slug" varchar(20) NOT NULL,
	"bio" text,
	"avatar_url" varchar(500),
	"specialties" jsonb,
	"style_description" text,
	"style_prompt" text,
	"style_note_balance" jsonb,
	"style_flavor_preferences" jsonb,
	"website_url" varchar(500),
	"social_links" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creator_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "creator_profiles_creator_id_slug_unique" UNIQUE("creator_id_slug")
);
--> statement-breakpoint
CREATE TABLE "creator_profiles_legacy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"bio" text,
	"specialty" varchar(200),
	"avatar_url" varchar(500),
	"tier" varchar(20) DEFAULT 'APPRENTICE' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"recipe_count" integer DEFAULT 0 NOT NULL,
	"published_recipe_count" integer DEFAULT 0 NOT NULL,
	"total_sales" integer DEFAULT 0 NOT NULL,
	"average_rating" numeric(3, 2) DEFAULT '0',
	"review_count" integer DEFAULT 0 NOT NULL,
	"repeat_rate" numeric(5, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creator_profiles_legacy_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "creator_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tier" varchar(20) DEFAULT 'APPRENTICE' NOT NULL,
	"tier_score" numeric(10, 2) DEFAULT '0' NOT NULL,
	"recipe_sales_count" integer DEFAULT 0 NOT NULL,
	"recipe_review_count" integer DEFAULT 0 NOT NULL,
	"avg_rating" numeric(3, 2) DEFAULT '0.00' NOT NULL,
	"repeat_rate" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"favorite_count" integer DEFAULT 0 NOT NULL,
	"months_below_threshold" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creator_stats_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "creator_style_flavor_prefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"style_id" uuid NOT NULL,
	"flavor_id" uuid NOT NULL,
	"boost" numeric(3, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_styles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"top_bias" numeric(3, 2) DEFAULT '0' NOT NULL,
	"middle_bias" numeric(3, 2) DEFAULT '0' NOT NULL,
	"last_bias" numeric(3, 2) DEFAULT '0' NOT NULL,
	"style_description" text,
	"ai_instruction" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creator_styles_creator_id_unique" UNIQUE("creator_id")
);
--> statement-breakpoint
CREATE TABLE "ec_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipping_fee_yen" integer DEFAULT 0 NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '10.0' NOT NULL,
	"free_shipping_threshold_yen" integer DEFAULT 5000 NOT NULL,
	"payment_provider" varchar(30) DEFAULT 'stripe' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flavor_compatibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"flavor_a_id" uuid NOT NULL,
	"flavor_b_id" uuid NOT NULL,
	"score" numeric(3, 1) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_flavor_compatibility_pair" UNIQUE("creator_id","flavor_a_id","flavor_b_id")
);
--> statement-breakpoint
CREATE TABLE "flavors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_ja" varchar(100) NOT NULL,
	"name_en" varchar(100) NOT NULL,
	"note_type" varchar(10) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "keyword_flavor_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keyword_id" uuid NOT NULL,
	"flavor_id" uuid NOT NULL,
	"weight" numeric(5, 4) NOT NULL,
	"note_type" varchar(10) NOT NULL,
	"creator_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"word" varchar(100) NOT NULL,
	"category" varchar(20) DEFAULT 'FREE' NOT NULL,
	"is_preset" boolean DEFAULT false NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email_order_updates" boolean DEFAULT true NOT NULL,
	"email_reviews" boolean DEFAULT true NOT NULL,
	"email_royalty" boolean DEFAULT true NOT NULL,
	"email_system" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text,
	"data" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" varchar(200) NOT NULL,
	"price_yen" integer NOT NULL,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"total_yen" integer NOT NULL,
	"discount_yen" integer DEFAULT 0 NOT NULL,
	"stripe_session_id" varchar(255),
	"stripe_payment_intent_id" varchar(255),
	"shipping_recipient_name" varchar(100) NOT NULL,
	"shipping_postal_code" varchar(10) NOT NULL,
	"shipping_prefecture" varchar(20) NOT NULL,
	"shipping_city" varchar(100) NOT NULL,
	"shipping_address_line_1" varchar(200) NOT NULL,
	"shipping_address_line_2" varchar(200),
	"shipping_phone" varchar(20) NOT NULL,
	"cancelled_at" timestamp,
	"cancel_reason" varchar(30),
	"cancel_detail" text,
	"delivered_at" timestamp,
	"receipt_issued_at" timestamp,
	"receipt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"price_yen" integer NOT NULL,
	"image_url" varchar(500),
	"blend_result_id" uuid,
	"recipe_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_visitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"visitor_id" uuid NOT NULL,
	"visited_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prohibited_combinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"flavor_a_id" uuid NOT NULL,
	"flavor_b_id" uuid NOT NULL,
	"reason" varchar(30) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_prohibited_combinations_pair" UNIQUE("creator_id","flavor_a_id","flavor_b_id")
);
--> statement-breakpoint
CREATE TABLE "recipe_flavors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"flavor_id" uuid NOT NULL,
	"ratio" numeric(5, 2) NOT NULL,
	"note_type" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_recipe_flavors_recipe_flavor" UNIQUE("recipe_id","flavor_id")
);
--> statement-breakpoint
CREATE TABLE "recipe_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid,
	"rating" integer NOT NULL,
	"title" varchar(200),
	"comment" text,
	"is_verified_purchase" boolean DEFAULT false NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_recipe_reviews_recipe_user" UNIQUE("recipe_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "recipe_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"sales_count" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"avg_rating" numeric(3, 2) DEFAULT '0.00' NOT NULL,
	"favorite_count" integer DEFAULT 0 NOT NULL,
	"total_revenue" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_stats_recipe_id_unique" UNIQUE("recipe_id")
);
--> statement-breakpoint
CREATE TABLE "shipping_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" varchar(50) NOT NULL,
	"recipient_name" varchar(100) NOT NULL,
	"postal_code" varchar(10) NOT NULL,
	"prefecture" varchar(20) NOT NULL,
	"city" varchar(100) NOT NULL,
	"address_line_1" varchar(200) NOT NULL,
	"address_line_2" varchar(200),
	"phone" varchar(20) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"concept" text,
	"scene" varchar(30),
	"mood" varchar(30),
	"theme_id" varchar(50),
	"sub_theme" varchar(50),
	"top_ratio" numeric(5, 2) NOT NULL,
	"middle_ratio" numeric(5, 2) NOT NULL,
	"last_ratio" numeric(5, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'DRAFT' NOT NULL,
	"price_30ml" integer,
	"price_50ml" integer,
	"order_count" integer DEFAULT 0 NOT NULL,
	"total_revenue" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"image_url" varchar(500),
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "theme_axes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_theme_axes_creator_type_name" UNIQUE("creator_id","type","name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"role" varchar(20) DEFAULT 'CUSTOMER' NOT NULL,
	"taste_preferences" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blend_request_flavors" ADD CONSTRAINT "blend_request_flavors_blend_request_id_blend_requests_id_fk" FOREIGN KEY ("blend_request_id") REFERENCES "public"."blend_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blend_request_flavors" ADD CONSTRAINT "blend_request_flavors_flavor_id_flavors_id_fk" FOREIGN KEY ("flavor_id") REFERENCES "public"."flavors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blend_request_keywords" ADD CONSTRAINT "blend_request_keywords_blend_request_id_blend_requests_id_fk" FOREIGN KEY ("blend_request_id") REFERENCES "public"."blend_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blend_request_keywords" ADD CONSTRAINT "blend_request_keywords_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blend_requests" ADD CONSTRAINT "blend_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blend_requests" ADD CONSTRAINT "blend_requests_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blend_requests" ADD CONSTRAINT "blend_requests_parent_blend_id_blend_requests_id_fk" FOREIGN KEY ("parent_blend_id") REFERENCES "public"."blend_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blend_result_flavors" ADD CONSTRAINT "blend_result_flavors_blend_result_id_blend_results_id_fk" FOREIGN KEY ("blend_result_id") REFERENCES "public"."blend_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blend_result_flavors" ADD CONSTRAINT "blend_result_flavors_flavor_id_flavors_id_fk" FOREIGN KEY ("flavor_id") REFERENCES "public"."flavors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blend_results" ADD CONSTRAINT "blend_results_blend_request_id_blend_requests_id_fk" FOREIGN KEY ("blend_request_id") REFERENCES "public"."blend_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_applications" ADD CONSTRAINT "creator_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_applications" ADD CONSTRAINT "creator_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_favorites" ADD CONSTRAINT "creator_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_favorites" ADD CONSTRAINT "creator_favorites_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_flavor_notes" ADD CONSTRAINT "creator_flavor_notes_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_flavor_notes" ADD CONSTRAINT "creator_flavor_notes_flavor_id_flavors_id_fk" FOREIGN KEY ("flavor_id") REFERENCES "public"."flavors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_profiles_legacy" ADD CONSTRAINT "creator_profiles_legacy_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_stats" ADD CONSTRAINT "creator_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_style_flavor_prefs" ADD CONSTRAINT "creator_style_flavor_prefs_style_id_creator_styles_id_fk" FOREIGN KEY ("style_id") REFERENCES "public"."creator_styles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_style_flavor_prefs" ADD CONSTRAINT "creator_style_flavor_prefs_flavor_id_flavors_id_fk" FOREIGN KEY ("flavor_id") REFERENCES "public"."flavors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_styles" ADD CONSTRAINT "creator_styles_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flavor_compatibility" ADD CONSTRAINT "flavor_compatibility_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flavor_compatibility" ADD CONSTRAINT "flavor_compatibility_flavor_a_id_flavors_id_fk" FOREIGN KEY ("flavor_a_id") REFERENCES "public"."flavors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flavor_compatibility" ADD CONSTRAINT "flavor_compatibility_flavor_b_id_flavors_id_fk" FOREIGN KEY ("flavor_b_id") REFERENCES "public"."flavors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_flavor_rules" ADD CONSTRAINT "keyword_flavor_rules_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_flavor_rules" ADD CONSTRAINT "keyword_flavor_rules_flavor_id_flavors_id_fk" FOREIGN KEY ("flavor_id") REFERENCES "public"."flavors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_flavor_rules" ADD CONSTRAINT "keyword_flavor_rules_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_favorites" ADD CONSTRAINT "product_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_favorites" ADD CONSTRAINT "product_favorites_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_blend_result_id_blend_results_id_fk" FOREIGN KEY ("blend_result_id") REFERENCES "public"."blend_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_recipe_id_signature_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."signature_recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_visitors" ADD CONSTRAINT "profile_visitors_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_visitors" ADD CONSTRAINT "profile_visitors_visitor_id_users_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prohibited_combinations" ADD CONSTRAINT "prohibited_combinations_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prohibited_combinations" ADD CONSTRAINT "prohibited_combinations_flavor_a_id_flavors_id_fk" FOREIGN KEY ("flavor_a_id") REFERENCES "public"."flavors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prohibited_combinations" ADD CONSTRAINT "prohibited_combinations_flavor_b_id_flavors_id_fk" FOREIGN KEY ("flavor_b_id") REFERENCES "public"."flavors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_flavors" ADD CONSTRAINT "recipe_flavors_recipe_id_signature_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."signature_recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_flavors" ADD CONSTRAINT "recipe_flavors_flavor_id_flavors_id_fk" FOREIGN KEY ("flavor_id") REFERENCES "public"."flavors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_reviews" ADD CONSTRAINT "recipe_reviews_recipe_id_signature_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."signature_recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_reviews" ADD CONSTRAINT "recipe_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_reviews" ADD CONSTRAINT "recipe_reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_stats" ADD CONSTRAINT "recipe_stats_recipe_id_signature_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."signature_recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_addresses" ADD CONSTRAINT "shipping_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_recipes" ADD CONSTRAINT "signature_recipes_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_axes" ADD CONSTRAINT "theme_axes_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_resource" ON "audit_logs" USING btree ("resource");--> statement-breakpoint
CREATE INDEX "idx_blend_request_flavors_request" ON "blend_request_flavors" USING btree ("blend_request_id");--> statement-breakpoint
CREATE INDEX "idx_blend_request_keywords_request" ON "blend_request_keywords" USING btree ("blend_request_id");--> statement-breakpoint
CREATE INDEX "idx_blend_requests_user" ON "blend_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_blend_requests_parent" ON "blend_requests" USING btree ("parent_blend_id");--> statement-breakpoint
CREATE INDEX "idx_blend_result_flavors_result" ON "blend_result_flavors" USING btree ("blend_result_id");--> statement-breakpoint
CREATE INDEX "idx_cart_items_user" ON "cart_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_coupon_usages_coupon" ON "coupon_usages" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX "idx_coupon_usages_user" ON "coupon_usages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_coupons_code" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_creator_applications_user" ON "creator_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_creator_applications_status" ON "creator_applications" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_creator_favorites_user_creator" ON "creator_favorites" USING btree ("user_id","creator_id");--> statement-breakpoint
CREATE INDEX "idx_creator_favorites_user" ON "creator_favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_creator_favorites_creator" ON "creator_favorites" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "idx_creator_flavor_notes_creator" ON "creator_flavor_notes" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "idx_creator_profiles_user" ON "creator_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_creator_profiles_slug" ON "creator_profiles" USING btree ("creator_id_slug");--> statement-breakpoint
CREATE INDEX "idx_creator_profiles_active" ON "creator_profiles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_creator_profiles_tier" ON "creator_profiles_legacy" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "idx_creator_profiles_verified" ON "creator_profiles_legacy" USING btree ("is_verified");--> statement-breakpoint
CREATE INDEX "idx_creator_stats_user" ON "creator_stats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_creator_style_flavor_prefs_style" ON "creator_style_flavor_prefs" USING btree ("style_id");--> statement-breakpoint
CREATE INDEX "idx_flavor_compatibility_creator" ON "flavor_compatibility" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "idx_keyword_flavor_rules_keyword" ON "keyword_flavor_rules" USING btree ("keyword_id");--> statement-breakpoint
CREATE INDEX "idx_keyword_flavor_rules_flavor" ON "keyword_flavor_rules" USING btree ("flavor_id");--> statement-breakpoint
CREATE INDEX "idx_keywords_word" ON "keywords" USING btree ("word");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_created" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_is_read" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "idx_order_items_order" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_orders_user" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_orders_status" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_user_id" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_expires_at" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_favorites_user_product" ON "product_favorites" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_profile_visitors_creator" ON "profile_visitors" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "idx_profile_visitors_visitor" ON "profile_visitors" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "idx_prohibited_combinations_creator" ON "prohibited_combinations" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_flavors_recipe" ON "recipe_flavors" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_flavors_flavor" ON "recipe_flavors" USING btree ("flavor_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_reviews_recipe" ON "recipe_reviews" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_reviews_user" ON "recipe_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_shipping_addresses_user" ON "shipping_addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_signature_recipes_creator" ON "signature_recipes" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "idx_signature_recipes_status" ON "signature_recipes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_signature_recipes_theme" ON "signature_recipes" USING btree ("theme_id");--> statement-breakpoint
CREATE INDEX "idx_theme_axes_creator" ON "theme_axes" USING btree ("creator_id");