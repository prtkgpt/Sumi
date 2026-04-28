import 'server-only';
import { Resend } from 'resend';
import { env } from '@/env';

const globalForResend = globalThis as unknown as { __sumiResend?: Resend };

export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

function getClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (globalForResend.__sumiResend) return globalForResend.__sumiResend;
  globalForResend.__sumiResend = new Resend(env.RESEND_API_KEY);
  return globalForResend.__sumiResend;
}

export type SendEmailInput = {
  to: string | string[];
  from?: string;
  subject: string;
  /** HTML body (preferred) */
  html?: string;
  /** Plain-text fallback body */
  text?: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'not_configured' | 'failed'; error?: string };

/**
 * Thin wrapper around Resend. Returns a structured result so call sites
 * can branch on `not_configured` without throwing — if email isn't wired
 * up on this deployment, the caller's flow continues.
 *
 * Currently a placeholder — no app code calls it yet. Wired in for v0.9
 * (invoice email, password reset, etc.).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const client = getClient();
  if (!client) return { ok: false, reason: 'not_configured' };

  const from = input.from ?? 'Sumi <noreply@sumi.app>';
  const to = Array.isArray(input.to) ? input.to : [input.to];
  if (!input.html && !input.text) {
    return { ok: false, reason: 'failed', error: 'either html or text is required' };
  }
  try {
    const result = input.html
      ? await client.emails.send({
          from,
          to,
          subject: input.subject,
          html: input.html,
          text: input.text,
          replyTo: input.replyTo,
        })
      : await client.emails.send({
          from,
          to,
          subject: input.subject,
          text: input.text!,
          replyTo: input.replyTo,
        });
    if (result.error) {
      return {
        ok: false,
        reason: 'failed',
        error: result.error.message ?? 'unknown error',
      };
    }
    return { ok: true, id: result.data?.id ?? '' };
  } catch (err) {
    return {
      ok: false,
      reason: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
