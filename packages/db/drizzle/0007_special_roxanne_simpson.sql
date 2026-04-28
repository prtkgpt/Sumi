CREATE TYPE "public"."entity_type" AS ENUM('sole_prop', 'llc', 's_corp', 'c_corp', 'partnership', 'nonprofit', 'other');--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "address_line1" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "address_line2" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "country" text DEFAULT 'US' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "ein_encrypted" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "entity_type" "entity_type";--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "stripe_secret_key_encrypted" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "stripe_webhook_secret_encrypted" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "stripe_account_id" text;