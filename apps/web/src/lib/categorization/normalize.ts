/**
 * Normalizes a merchant string for stable rule matching across small
 * variations. Plaid often returns the same merchant with slight differences
 * across transactions (extra location codes, payment processor prefixes,
 * stray punctuation, varying case), so we collapse to a canonical form
 * before keying rules off it.
 *
 * Rules:
 *   - lowercase
 *   - strip leading processor prefixes (TST*, SQ *, SP *, PP*, PYPL*, etc.)
 *   - strip trailing 4-digit auth/store codes
 *   - drop punctuation that isn't part of an alphanumeric token
 *   - collapse runs of whitespace
 */

const PROCESSOR_PREFIXES = [
  /^tst\*\s*/i,
  /^sq\s*\*\s*/i,
  /^sp\s*\*\s*/i,
  /^pp\s*\*\s*/i,
  /^pypl\s*\*\s*/i,
  /^paypal\s*\*\s*/i,
  /^stripe\s*\*\s*/i,
  /^square\s*\*\s*/i,
  /^venmo\s*\*\s*/i,
];

export function normalizeMerchant(input: string | null | undefined): string {
  if (!input) return '';
  let s = input.toLowerCase().trim();

  for (const re of PROCESSOR_PREFIXES) {
    s = s.replace(re, '');
  }

  // Trim trailing 3-6 digit store/auth codes (e.g. "Walmart #4521")
  s = s.replace(/\s+#?\d{3,6}\s*$/i, '');

  // Drop common punctuation noise but keep alphanumerics and inner whitespace.
  s = s.replace(/[^\p{L}\p{N}\s&'-]/gu, ' ');

  // Collapse whitespace.
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}
