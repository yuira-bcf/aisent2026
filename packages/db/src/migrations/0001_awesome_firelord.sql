CREATE TABLE "platform_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(50) NOT NULL,
	"value" varchar(500) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "royalties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"rate" numeric(5, 4) NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"period" varchar(7) NOT NULL,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "royalties" ADD CONSTRAINT "royalties_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "royalties" ADD CONSTRAINT "royalties_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_royalties_creator" ON "royalties" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "idx_royalties_order" ON "royalties" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_royalties_period" ON "royalties" USING btree ("period");--> statement-breakpoint
CREATE INDEX "idx_royalties_status" ON "royalties" USING btree ("status");