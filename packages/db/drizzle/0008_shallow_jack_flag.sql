CREATE TYPE "public"."receipt_kind" AS ENUM('image', 'pdf');--> statement-breakpoint
CREATE TYPE "public"."receipt_status" AS ENUM('uploaded', 'extracted', 'matched', 'unmatched', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"transaction_id" uuid,
	"file_url" text NOT NULL,
	"file_name" text,
	"kind" "receipt_kind" NOT NULL,
	"size_bytes" bigint,
	"status" "receipt_status" DEFAULT 'uploaded' NOT NULL,
	"ocr_merchant" text,
	"ocr_posted_at" timestamp with time zone,
	"ocr_amount_cents" bigint,
	"ocr_currency" text,
	"ocr_raw" jsonb,
	"ocr_error" text,
	"uploaded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receipts" ADD CONSTRAINT "receipts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receipts" ADD CONSTRAINT "receipts_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receipts" ADD CONSTRAINT "receipts_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "receipts_business_id_idx" ON "receipts" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "receipts_transaction_id_idx" ON "receipts" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "receipts_business_status_idx" ON "receipts" USING btree ("business_id","status");