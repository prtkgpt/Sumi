import 'server-only';
import { put } from '@vercel/blob';
import { env } from '@/env';

export type UploadResult = {
  url: string;
  pathname: string;
};

export function isBlobConfigured(): boolean {
  return Boolean(env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Uploads a binary blob to Vercel Blob and returns the public URL.
 * Fails clearly if BLOB_READ_WRITE_TOKEN isn't set instead of letting
 * the upstream library throw an opaque error.
 */
export async function uploadBlob(
  pathname: string,
  body: Blob | Buffer,
  options?: { contentType?: string }
): Promise<UploadResult> {
  if (!env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN is not set. Add a Vercel Blob store to enable receipt uploads.'
    );
  }
  const result = await put(pathname, body, {
    access: 'public',
    token: env.BLOB_READ_WRITE_TOKEN,
    contentType: options?.contentType,
    addRandomSuffix: true,
  });
  return { url: result.url, pathname: result.pathname };
}
