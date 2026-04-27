ALTER TABLE "financial_accounts" ADD COLUMN "current_balance_cents" bigint;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD COLUMN "available_balance_cents" bigint;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD COLUMN "last_balance_at" timestamp with time zone;