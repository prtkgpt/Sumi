import 'server-only';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { getDb, transactions } from '@sumi/db';

const DAY_TOLERANCE = 7;
const CENTS_TOLERANCE = 50; // ±$0.50

/**
 * Given an OCR'd receipt, find the best-matching transaction within a
 * date window and amount tolerance. Returns null if no candidate is
 * unambiguous.
 *
 * Heuristic:
 *   1. Filter transactions in the same business posted within ±7 days
 *      of the receipt date.
 *   2. Require absolute amount match within ±$0.50 (Plaid sometimes
 *      truncates pending tips; small rounding is common).
 *   3. If exactly one candidate, return it.
 *   4. If multiple, pick the one with the smallest combined date+amount
 *      delta.
 *   5. If zero, return null (caller marks receipt as unmatched).
 */
export async function findMatchingTransaction(input: {
  businessId: string;
  ocrPostedAt: Date;
  ocrAmountCents: number;
}): Promise<{ id: string } | null> {
  const db = getDb();
  const lower = new Date(
    input.ocrPostedAt.getTime() - DAY_TOLERANCE * 86_400_000
  );
  const upper = new Date(
    input.ocrPostedAt.getTime() + (DAY_TOLERANCE + 1) * 86_400_000
  );

  // Receipts represent outflows almost always. Plaid stores outflows
  // negative (per our convention). Compare against the absolute value.
  const candidates = await db
    .select({
      id: transactions.id,
      postedAt: transactions.postedAt,
      amountCents: transactions.amountCents,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.businessId, input.businessId),
        gte(transactions.postedAt, lower),
        lt(transactions.postedAt, upper),
        sql`abs(abs(${transactions.amountCents}) - ${input.ocrAmountCents}) <= ${CENTS_TOLERANCE}`
      )
    );

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return { id: candidates[0].id };

  let best = candidates[0];
  let bestScore = score(best, input);
  for (const c of candidates.slice(1)) {
    const s = score(c, input);
    if (s < bestScore) {
      best = c;
      bestScore = s;
    }
  }
  return { id: best.id };
}

function score(
  candidate: { postedAt: Date; amountCents: number },
  input: { ocrPostedAt: Date; ocrAmountCents: number }
): number {
  const daysDelta =
    Math.abs(candidate.postedAt.getTime() - input.ocrPostedAt.getTime()) /
    86_400_000;
  const centsDelta = Math.abs(
    Math.abs(candidate.amountCents) - input.ocrAmountCents
  );
  // Weight amount more strongly than date — same amount on a different
  // day is a stronger signal than nearby date with diverging amount.
  return daysDelta + centsDelta / 10;
}
