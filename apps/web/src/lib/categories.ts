import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb, categories, type Category } from '@sumi/db';

type CategorySeed = {
  kind: Category['kind'];
  slug: string;
  displayName: string;
  scheduleCLine: string | null;
};

/**
 * Schedule C (Form 1040) Part II expense lines plus income, transfer,
 * owner_draw, and personal buckets. Seeded once per business so users have
 * something to pick on day one.
 */
const SCHEDULE_C_SEED: CategorySeed[] = [
  // Income
  { kind: 'income', slug: 'sales', displayName: 'Sales', scheduleCLine: 'Line 1' },
  {
    kind: 'income',
    slug: 'other-income',
    displayName: 'Other income',
    scheduleCLine: 'Line 6',
  },

  // Expense — Schedule C Part II line numbers
  { kind: 'expense', slug: 'advertising', displayName: 'Advertising', scheduleCLine: 'Line 8' },
  { kind: 'expense', slug: 'car-truck', displayName: 'Car & truck', scheduleCLine: 'Line 9' },
  { kind: 'expense', slug: 'commissions-fees', displayName: 'Commissions & fees', scheduleCLine: 'Line 10' },
  { kind: 'expense', slug: 'contract-labor', displayName: 'Contract labor', scheduleCLine: 'Line 11' },
  { kind: 'expense', slug: 'depreciation', displayName: 'Depreciation', scheduleCLine: 'Line 13' },
  { kind: 'expense', slug: 'insurance', displayName: 'Insurance', scheduleCLine: 'Line 15' },
  { kind: 'expense', slug: 'interest', displayName: 'Interest', scheduleCLine: 'Line 16' },
  { kind: 'expense', slug: 'legal-professional', displayName: 'Legal & professional', scheduleCLine: 'Line 17' },
  { kind: 'expense', slug: 'office-expense', displayName: 'Office expense', scheduleCLine: 'Line 18' },
  { kind: 'expense', slug: 'rent-lease', displayName: 'Rent & lease', scheduleCLine: 'Line 20' },
  { kind: 'expense', slug: 'repairs-maintenance', displayName: 'Repairs & maintenance', scheduleCLine: 'Line 21' },
  { kind: 'expense', slug: 'supplies', displayName: 'Supplies', scheduleCLine: 'Line 22' },
  { kind: 'expense', slug: 'taxes-licenses', displayName: 'Taxes & licenses', scheduleCLine: 'Line 23' },
  { kind: 'expense', slug: 'travel', displayName: 'Travel', scheduleCLine: 'Line 24a' },
  { kind: 'expense', slug: 'meals', displayName: 'Meals', scheduleCLine: 'Line 24b' },
  { kind: 'expense', slug: 'utilities', displayName: 'Utilities', scheduleCLine: 'Line 25' },
  { kind: 'expense', slug: 'wages', displayName: 'Wages', scheduleCLine: 'Line 26' },
  { kind: 'expense', slug: 'other-expense', displayName: 'Other expense', scheduleCLine: 'Line 27a' },

  // Non-P&L buckets
  { kind: 'transfer', slug: 'transfer', displayName: 'Transfer', scheduleCLine: null },
  { kind: 'owner_draw', slug: 'owner-draw', displayName: 'Owner draw', scheduleCLine: null },
  { kind: 'personal', slug: 'personal', displayName: 'Personal', scheduleCLine: null },
];

/**
 * Idempotently seeds Schedule C categories for a business. Safe to call on
 * every business creation or before the first transaction insert.
 */
export async function ensureCategorySeed(businessId: string): Promise<void> {
  const db = getDb();
  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.businessId, businessId))
    .limit(1);
  if (existing.length > 0) return;

  await db.insert(categories).values(
    SCHEDULE_C_SEED.map((c) => ({
      businessId,
      kind: c.kind,
      slug: c.slug,
      displayName: c.displayName,
      scheduleCLine: c.scheduleCLine,
      isSystem: true,
    }))
  );
}
