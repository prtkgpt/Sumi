import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, receipts } from '@sumi/db';
import { requireBusiness } from '@/lib/auth/require-business';
import { isBlobConfigured, uploadBlob } from '@/lib/blob';
import { ocrReceipt, type OcrResult } from '@/lib/receipts/ocr';
import { findMatchingTransaction } from '@/lib/receipts/match';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES = new Set<
  'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'
>(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);

type AllowedType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif'
  | 'application/pdf';

export async function POST(req: Request) {
  if (!isBlobConfigured()) {
    return NextResponse.json(
      { error: 'receipt uploads not enabled — add BLOB_READ_WRITE_TOKEN' },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: 'expected multipart form-data' },
      { status: 400 }
    );
  }

  const bizId = formData.get('bizId');
  const file = formData.get('file');
  if (typeof bizId !== 'string' || !(file instanceof File)) {
    return NextResponse.json({ error: 'invalid form fields' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `file is larger than ${MAX_BYTES} bytes` },
      { status: 413 }
    );
  }
  if (!ALLOWED_TYPES.has(file.type as AllowedType)) {
    return NextResponse.json(
      {
        error: `unsupported file type: ${file.type}. Use JPG, PNG, WebP, GIF, or PDF.`,
      },
      { status: 400 }
    );
  }
  const mediaType = file.type as AllowedType;

  const { user, business } = await requireBusiness(bizId);

  const bytes = Buffer.from(await file.arrayBuffer());

  // Path includes business id so blobs are clearly scoped per tenant.
  const blobPath = `receipts/${business.id}/${Date.now()}-${file.name}`;
  const uploaded = await uploadBlob(blobPath, bytes, {
    contentType: file.type,
  });

  const db = getDb();
  const kind = file.type === 'application/pdf' ? 'pdf' : 'image';

  const [created] = await db
    .insert(receipts)
    .values({
      businessId: business.id,
      fileUrl: uploaded.url,
      fileName: file.name,
      kind,
      sizeBytes: file.size,
      status: 'uploaded',
      uploadedByUserId: user.id,
    })
    .returning({ id: receipts.id });

  // OCR + match. Errors here don't undo the upload — the receipt sits in
  // status='failed' and the user can retry or match manually.
  let ocr: OcrResult | null = null;
  try {
    ocr = await ocrReceipt({ bytes, mediaType });
  } catch (err) {
    await db
      .update(receipts)
      .set({
        status: 'failed',
        ocrError: err instanceof Error ? err.message : String(err),
        updatedAt: new Date(),
      })
      .where(eq(receipts.id, created.id));
    return NextResponse.json(
      { id: created.id, status: 'failed' },
      { status: 200 }
    );
  }

  const ocrPostedAtDate = ocr.postedAt
    ? new Date(`${ocr.postedAt}T12:00:00Z`)
    : null;
  const ocrAmountCents =
    typeof ocr.totalAmount === 'number'
      ? Math.round(ocr.totalAmount * 100)
      : null;

  let matchedTxnId: string | null = null;
  if (ocrPostedAtDate && ocrAmountCents) {
    try {
      const m = await findMatchingTransaction({
        businessId: business.id,
        ocrPostedAt: ocrPostedAtDate,
        ocrAmountCents,
      });
      matchedTxnId = m?.id ?? null;
    } catch (err) {
      console.error('match failed', err);
    }
  }

  const status: 'matched' | 'unmatched' | 'extracted' = matchedTxnId
    ? 'matched'
    : ocrPostedAtDate || ocrAmountCents
      ? 'unmatched'
      : 'extracted';

  await db
    .update(receipts)
    .set({
      transactionId: matchedTxnId,
      status,
      ocrMerchant: ocr.merchant,
      ocrPostedAt: ocrPostedAtDate,
      ocrAmountCents,
      ocrCurrency: ocr.currency,
      ocrRaw: ocr.raw as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(receipts.id, created.id));

  return NextResponse.json({
    id: created.id,
    status,
    transactionId: matchedTxnId,
    merchant: ocr.merchant,
    amountCents: ocrAmountCents,
  });
}
