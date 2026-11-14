CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(128) NOT NULL,
	"payload" jsonb NOT NULL,
	"trace_id" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"price_minor_units" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'CLP' NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_events" (
	"event_id" uuid NOT NULL,
	"consumer_name" varchar(128) NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processed_events_event_id_consumer_name_pk" PRIMARY KEY("event_id","consumer_name")
);
--> statement-breakpoint
CREATE TABLE "tracked_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"domain" varchar(128) NOT NULL,
	"title" text NOT NULL,
	"current_price_minor_units" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'CLP' NOT NULL,
	"status" varchar(32) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracked_products_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "user_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"product_id" uuid NOT NULL,
	"target_price_minor_units" bigint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_notified_at" timestamp with time zone,
	"last_notified_price_minor_units" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_product_id_tracked_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."tracked_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_alerts" ADD CONSTRAINT "user_alerts_product_id_tracked_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."tracked_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_outbox_events_pending" ON "outbox_events" USING btree ("status","next_retry_at") WHERE status = 'PENDING';--> statement-breakpoint
CREATE INDEX "idx_price_snapshots_product_recorded" ON "price_snapshots" USING btree ("product_id","recorded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_user_alerts_product_active" ON "user_alerts" USING btree ("product_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_alerts_user_product_active" ON "user_alerts" USING btree ("user_email","product_id") WHERE is_active = true;