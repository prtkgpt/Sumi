import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { getAnthropic } from './anthropic-client';

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 4096;
const MIN_CONFIDENCE = 0.7;

export type CategoryChoice = {
  slug: string;
  kind: string;
  displayName: string;
};

export type LLMTransaction = {
  /** Stable id we use to zip the response back. Echoed in the JSON output. */
  ref: string;
  merchant: string;
  description: string;
  /** Cents (negative = outflow). */
  amountCents: number;
  accountKind: string;
};

export type LLMVerdict = {
  ref: string;
  categorySlug: string | null;
  confidence: number;
};

const SYSTEM_PROMPT = `You are Sumi's bookkeeping copilot. You categorize US small-business
transactions into the IRS Schedule C taxonomy plus transfer / owner_draw /
personal buckets.

Rules:
- Pick exactly one category slug from the provided list, or null when no
  category is a confident match (e.g. ambiguous, multi-purpose, owner gray
  area).
- Never invent a slug. If nothing fits, return null.
- Bias to "personal" only for clearly personal spend (groceries, family
  doctor, kid's tuition).
- "Transfer" is only for moves between the user's own accounts, never for
  paying a vendor or being paid by a customer.
- Negative amounts are outflows (expenses). Positive amounts are inflows
  (income or refunds).
- Confidence is 0.0-1.0. Use >= 0.7 only when the merchant + description
  + amount sign make the category obvious.
- Return one verdict per transaction; preserve the input "ref" exactly.`;

const RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    verdicts: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          ref: { type: 'string' as const },
          category_slug: { type: ['string', 'null'] as const },
          confidence: { type: 'number' as const },
        },
        required: ['ref', 'category_slug', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['verdicts'],
  additionalProperties: false,
};

function formatCategoryList(categories: CategoryChoice[]): string {
  return categories
    .map((c) => `- ${c.slug} (${c.kind}): ${c.displayName}`)
    .join('\n');
}

function formatTransactions(txns: LLMTransaction[]): string {
  return txns
    .map((t) => {
      const sign = t.amountCents >= 0 ? '+' : '-';
      const dollars = (Math.abs(t.amountCents) / 100).toFixed(2);
      return `- ref=${t.ref} | account=${t.accountKind} | amount=${sign}$${dollars} | merchant=${JSON.stringify(t.merchant || '')} | description=${JSON.stringify(t.description || '')}`;
    })
    .join('\n');
}

/**
 * Categorize a batch of transactions in a single Claude call. Returns a
 * verdict per input row; verdicts below MIN_CONFIDENCE come back with
 * `categorySlug: null` so the caller leaves them uncategorized.
 */
export async function categorizeBatch(
  txns: LLMTransaction[],
  categories: CategoryChoice[]
): Promise<LLMVerdict[]> {
  if (txns.length === 0) return [];
  const client = getAnthropic();

  // Cache the system + category list so back-to-back batches share a prefix.
  // Below the model's min cacheable threshold this silently no-ops; that's
  // fine — we add the marker now so it kicks in once the prompt grows.
  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: 'text', text: SYSTEM_PROMPT },
    {
      type: 'text',
      text: `Available categories:\n${formatCategoryList(categories)}`,
      cache_control: { type: 'ephemeral' },
    },
  ];

  const userText = `Categorize the following ${txns.length} transaction(s). Respond with strict JSON matching the response schema.\n\nTransactions:\n${formatTransactions(txns)}`;

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemBlocks,
      messages: [{ role: 'user', content: userText }],
      output_config: {
        format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
      },
    });
  } catch (err) {
    if (
      err instanceof Anthropic.RateLimitError ||
      err instanceof Anthropic.InternalServerError
    ) {
      // Transient — caller can decide to retry. For v0.3 we just leave the
      // batch uncategorized and let the next sync try again.
      console.warn('categorizeBatch transient error', err.message);
      return txns.map((t) => ({
        ref: t.ref,
        categorySlug: null,
        confidence: 0,
      }));
    }
    throw err;
  }

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text'
  );
  if (!textBlock) return [];

  let parsed: { verdicts?: Array<{ ref: string; category_slug: string | null; confidence: number }> };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    console.warn('categorizeBatch: response was not valid JSON', textBlock.text.slice(0, 200));
    return [];
  }

  const verdicts = parsed.verdicts ?? [];
  return verdicts.map((v) => ({
    ref: v.ref,
    categorySlug:
      v.category_slug && v.confidence >= MIN_CONFIDENCE ? v.category_slug : null,
    confidence: typeof v.confidence === 'number' ? v.confidence : 0,
  }));
}
