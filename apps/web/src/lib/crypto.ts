import 'server-only';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from 'node:crypto';
import { env } from '@/env';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  cachedKey = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  if (cachedKey.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY decoded to ${cachedKey.length} bytes; expected 32.`
    );
  }
  return cachedKey;
}

/**
 * AES-256-GCM encrypt. Returns base64(iv || tag || ciphertext).
 */
export function encryptString(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv) as CipherGCM;
  const ct = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

/**
 * Inverse of `encryptString`. Throws if the auth tag fails to verify.
 */
export function decryptString(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error('Encrypted payload is too short to be valid');
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ct = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv) as DecipherGCM;
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}
