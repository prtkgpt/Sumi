CREATE TYPE "public"."category_kind" AS ENUM('income', 'expense', 'transfer', 'owner_draw', 'personal');--> statement-breakpoint
CREATE TYPE "public"."financial_account_kind" AS ENUM('bank_checking', 'bank_savings', 'credit_card', 'manual_cash');--> statement-breakpoint
CREATE TYPE "public"."plaid_item_status" AS ENUM('active', 'revoked', 'error');--> statement-breakpoint
CREATE TYPE "public"."transaction_source" AS ENUM('plaid', 'manual');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'posted', 'reviewed');--> statement-breakpoint
CREATE TYPE "public"."webhook_provider" AS ENUM('plaid');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"kind" "category_kind" NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"schedule_c_line" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"plaid_item_id" uuid,
	"plaid_account_id" text,
	"kind" "financial_account_kind" NOT NULL,
	"name" text NOT NULL,
	"mask" text,
	"institution_name" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plaid_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"plaid_item_id" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"institution_id" text,
	"institution_name" text,
	"cursor" text,
	"status" "plaid_item_status" DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"posted_at" timestamp with time zone NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"merchant" text,
	"description" text NOT NULL,
	"source" "transaction_source" NOT NULL,
	"plaid_transaction_id" text,
	"status" "transaction_status" DEFAULT 'posted' NOT NULL,
	"notes" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "webhook_provider" NOT NULL,
	"external_event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "categories" ADD CONSTRAINT "categories_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_plaid_item_id_plaid_items_id_fk" FOREIGN KEY ("plaid_item_id") REFERENCES "public"."plaid_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plaid_items" ADD CONSTRAINT "plaid_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "categories_business_slug_idx" ON "categories" USING btree ("business_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_business_kind_idx" ON "categories" USING btree ("business_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "financial_accounts_plaid_account_id_idx" ON "financial_accounts" USING btree ("plaid_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_accounts_business_id_idx" ON "financial_accounts" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "plaid_items_plaid_item_id_idx" ON "plaid_items" USING btree ("plaid_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plaid_items_business_id_idx" ON "plaid_items" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_plaid_transaction_id_idx" ON "transactions" USING btree ("plaid_transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_business_posted_at_idx" ON "transactions" USING btree ("business_id","posted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_business_category_idx" ON "transactions" USING btree ("business_id","category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_account_id_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_provider_event_idx" ON "webhook_events" USING btree ("provider","external_event_id");