import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { getAnthropic } from '@/lib/categorization/anthropic-client';

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 1024;

export type OcrResult = {
  merchant: string | null;
  postedAt: string | null; // ISO YYYY-MM-DD
  totalAmount: number | null; // dollars
  currency: string | null; // ISO 4217
  raw: unknown;
};

const SYSTEM = `You are a receipt OCR engine. The user uploads an image or PDF
of a paper or digital receipt. Extract:

- merchant: the business that provided the goods/service. Title-cased; no
  store numbers, no city codes.
- date: ISO 8601 (YYYY-MM-DD). The transaction date — not "Printed on" or
  "Statement date".
- total_amount: the FINAL amount paid by the customer, in dollars (e.g.
  42.50). Tip + tax included. Not the subtotal.
- currency: ISO 4217 (USD by default).

Return strict JSON. If a field can't be confidently read, return null
for that field.`;

const SCHEMA = {
  type: 'object' as const,
  properties: {
    merchant: { type: ['string', 'null'] as const },
    date: { type: ['string', 'null'] as const },
    total_amount: { type: ['number', 'null'] as const },
    currency: { type: ['string', 'null'] as const },
  },
  required: ['merchant', 'date', 'total_amount', 'currency'],
  additionalProperties: false,
};

export async function ocrReceipt(input: {
  bytes: Buffer;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf';
}): Promise<OcrResult> {
  const client = getAnthropic();

  const userContent: Anthropic.ContentBlockParam[] =
    input.mediaType === 'application/pdf'
      ? [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: input.bytes.toString('base64'),
            },
          },
          {
            type: 'text',
            text: 'Extract the receipt details and respond as JSON matching the schema.',
          },
        ]
      : [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: input.mediaType,
              data: input.bytes.toString('base64'),
            },
          },
          {
            type: 'text',
            text: 'Extract the receipt details and respond as JSON matching the schema.',
          },
        ];

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM,
    messages: [{ role: 'user', content: userContent }],
    output_config: {
      format: { type: 'json_schema', schema: SCHEMA },
    },
  });

  const textBlock = resp.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text'
  );
  if (!textBlock) {
    return { merchant: null, postedAt: null, totalAmount: null, currency: null, raw: resp.content };
  }

  let parsed: {
    merchant?: string | null;
    date?: string | null;
    total_amount?: number | null;
    currency?: string | null;
  };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    return {
      merchant: null,
      postedAt: null,
      totalAmount: null,
      currency: null,
      raw: textBlock.text,
    };
  }

  return {
    merchant: parsed.merchant ?? null,
    postedAt: parsed.date ?? null,
    totalAmount:
      typeof parsed.total_amount === 'number' ? parsed.total_amount : null,
    currency: parsed.currency ?? null,
    raw: parsed,
  };
}
