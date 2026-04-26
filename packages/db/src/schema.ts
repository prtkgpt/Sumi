import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
