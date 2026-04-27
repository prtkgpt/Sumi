import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
  bigint,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const membershipRole = pgEnum('membership_role', [
  'owner',
  'admin',
  'member',
]);

export const membershipStatus = pgEnum('membership_status', [
  'active',
  'invited',
  'revoked',
]);

export const financialAccountKind = pgEnum('financial_account_kind', [
  'bank_checking',
  'bank_savings',
  'credit_card',
  'manual_cash',
]);

export const categoryKind = pgEnum('category_kind', [
  'income',
  'expense',
  'transfer',
  'owner_draw',
  'personal',
]);

export const transactionSource = pgEnum('transaction_source', [
  'plaid',
  'manual',
]);

export const transactionStatus = pgEnum('transaction_status', [
  'pending',
  'posted',
  'reviewed',
]);

export const plaidItemStatus = pgEnum('plaid_item_status', [
  'active',
  'revoked',
  'error',
]);

export const webhookProvider = pgEnum('webhook_provider', ['plaid']);

export const categorizationSource = pgEnum('categorization_source', [
  'user',
  'llm',
]);

/**
 * App-side mirror of the authenticated user.
 * `stack_user_id` is the Stack Auth user id (kept as text since Stack issues opaque ids).
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    stackUserId: text('stack_user_id').notNull(),
    email: text('email').notNull(),
    displayName: text('display_name'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    stackUserIdx: uniqueIndex('users_stack_user_id_idx').on(t.stackUserId),
    emailIdx: index('users_email_idx').on(t.email),
  })
);

export const businesses = pgTable(
  'businesses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    legalName: text('legal_name').notNull(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ownerIdx: index('businesses_owner_user_id_idx').on(t.ownerUserId),
  })
);

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: membershipRole('role').notNull().default('member'),
    status: membershipStatus('status').notNull().default('active'),
    acceptedAt: timestamp('accepted_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqUserBiz: uniqueIndex('memberships_user_business_idx').on(
      t.userId,
      t.businessId
    ),
    bizIdx: index('memberships_business_id_idx').on(t.businessId),
  })
);

/**
 * One row per institution link. Holds the Plaid `access_token` (encrypted) and
 * the `/transactions/sync` cursor we advance on every webhook.
 */
export const plaidItems = pgTable(
  'plaid_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    plaidItemId: text('plaid_item_id').notNull(),
    accessTokenEncrypted: text('access_token_encrypted').notNull(),
    institutionId: text('institution_id'),
    institutionName: text('institution_name'),
    cursor: text('cursor'),
    status: plaidItemStatus('status').notNull().default('active'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    plaidItemIdx: uniqueIndex('plaid_items_plaid_item_id_idx').on(t.plaidItemId),
    bizIdx: index('plaid_items_business_id_idx').on(t.businessId),
  })
);

/**
 * Bank, credit-card, or cash account. Plaid-sourced rows reference the parent
 * `plaid_items` row; manual rows leave both `plaid_*` columns null.
 */
export const financialAccounts = pgTable(
  'financial_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    plaidItemId: uuid('plaid_item_id').references(() => plaidItems.id, {
      onDelete: 'cascade',
    }),
    plaidAccountId: text('plaid_account_id'),
    kind: financialAccountKind('kind').notNull(),
    name: text('name').notNull(),
    mask: text('mask'),
    institutionName: text('institution_name'),
    isArchived: boolean('is_archived').notNull().default(false),
    currentBalanceCents: bigint('current_balance_cents', { mode: 'number' }),
    availableBalanceCents: bigint('available_balance_cents', { mode: 'number' }),
    lastBalanceAt: timestamp('last_balance_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    plaidAccountIdx: uniqueIndex('financial_accounts_plaid_account_id_idx').on(
      t.plaidAccountId
    ),
    bizIdx: index('financial_accounts_business_id_idx').on(t.businessId),
  })
);

/**
 * Per-business categories. Schedule C taxonomy is seeded on first need;
 * users may add custom categories on top.
 */
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    kind: categoryKind('kind').notNull(),
    slug: text('slug').notNull(),
    displayName: text('display_name').notNull(),
    scheduleCLine: text('schedule_c_line'),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    bizSlugIdx: uniqueIndex('categories_business_slug_idx').on(
      t.businessId,
      t.slug
    ),
    bizKindIdx: index('categories_business_kind_idx').on(t.businessId, t.kind),
  })
);

/**
 * Core ledger row. Amounts are stored as cents (positive = inflow, negative =
 * outflow). Plaid-sourced rows are unique on `plaid_transaction_id`; manual
 * rows leave it null.
 */
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => financialAccounts.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    categorySource: categorizationSource('category_source'),
    postedAt: timestamp('posted_at', { withTimezone: true }).notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: text('currency').notNull().default('USD'),
    merchant: text('merchant'),
    description: text('description').notNull(),
    source: transactionSource('source').notNull(),
    plaidTransactionId: text('plaid_transaction_id'),
    status: transactionStatus('status').notNull().default('posted'),
    notes: text('notes'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    plaidTxnIdx: uniqueIndex('transactions_plaid_transaction_id_idx').on(
      t.plaidTransactionId
    ),
    bizPostedIdx: index('transactions_business_posted_at_idx').on(
      t.businessId,
      t.postedAt
    ),
    bizCategoryIdx: index('transactions_business_category_idx').on(
      t.businessId,
      t.categoryId
    ),
    accountIdx: index('transactions_account_id_idx').on(t.accountId),
  })
);

/**
 * Append-only idempotency log for inbound webhooks. Insert before processing;
 * if `external_event_id` already exists, short-circuit.
 */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: webhookProvider('provider').notNull(),
    externalEventId: text('external_event_id').notNull(),
    payload: jsonb('payload').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error'),
  },
  (t) => ({
    providerEventIdx: uniqueIndex('webhook_events_provider_event_idx').on(
      t.provider,
      t.externalEventId
    ),
  })
);

/**
 * Per-business merchant → category mapping. Drives the v0.3 auto-categorization
 * pipeline: when a Plaid transaction lands, we look up its normalized merchant
 * here. `source='user'` rows (manual overrides) win over `source='llm'` rows
 * via the unique key — see categorization layer for the upsert semantics.
 */
export const categorizationRules = pgTable(
  'categorization_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    merchantNormalized: text('merchant_normalized').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    source: categorizationSource('source').notNull(),
    confidence: text('confidence'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    bizMerchantIdx: uniqueIndex(
      'categorization_rules_business_merchant_idx'
    ).on(t.businessId, t.merchantNormalized),
  })
);

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  ownedBusinesses: many(businesses),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  owner: one(users, {
    fields: [businesses.ownerUserId],
    references: [users.id],
  }),
  memberships: many(memberships),
  financialAccounts: many(financialAccounts),
  categories: many(categories),
  transactions: many(transactions),
  plaidItems: many(plaidItems),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  business: one(businesses, {
    fields: [memberships.businessId],
    references: [businesses.id],
  }),
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
}));

export const plaidItemsRelations = relations(plaidItems, ({ one, many }) => ({
  business: one(businesses, {
    fields: [plaidItems.businessId],
    references: [businesses.id],
  }),
  accounts: many(financialAccounts),
}));

export const financialAccountsRelations = relations(
  financialAccounts,
  ({ one, many }) => ({
    business: one(businesses, {
      fields: [financialAccounts.businessId],
      references: [businesses.id],
    }),
    plaidItem: one(plaidItems, {
      fields: [financialAccounts.plaidItemId],
      references: [plaidItems.id],
    }),
    transactions: many(transactions),
  })
);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  business: one(businesses, {
    fields: [categories.businessId],
    references: [businesses.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  business: one(businesses, {
    fields: [transactions.businessId],
    references: [businesses.id],
  }),
  account: one(financialAccounts, {
    fields: [transactions.accountId],
    references: [financialAccounts.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  createdByUser: one(users, {
    fields: [transactions.createdByUserId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type PlaidItem = typeof plaidItems.$inferSelect;
export type NewPlaidItem = typeof plaidItems.$inferInsert;
export type FinancialAccount = typeof financialAccounts.$inferSelect;
export type NewFinancialAccount = typeof financialAccounts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
export type CategorizationRule = typeof categorizationRules.$inferSelect;
export type NewCategorizationRule = typeof categorizationRules.$inferInsert;
