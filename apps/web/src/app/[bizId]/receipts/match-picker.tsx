'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { matchReceipt } from './actions';

const NONE = 'none';

export type CandidateTransaction = {
  id: string;
  postedAt: string; // ISO
  description: string;
  merchant: string | null;
  amountCents: number;
};

function formatUsd(cents: number): string {
  return (Math.abs(cents) / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function MatchPicker({
  bizId,
  receiptId,
  currentTransactionId,
  candidates,
}: {
  bizId: string;
  receiptId: string;
  currentTransactionId: string | null;
  candidates: CandidateTransaction[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [value, setValue] = useState(currentTransactionId ?? NONE);

  return (
    <Select
      value={value}
      disabled={pending}
      onValueChange={(v) => {
        setValue(v);
        startTransition(async () => {
          try {
            const fd = new FormData();
            fd.set('bizId', bizId);
            fd.set('receiptId', receiptId);
            fd.set('transactionId', v === NONE ? '' : v);
            await matchReceipt(fd);
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Match failed');
          }
        });
      }}
    >
      <SelectTrigger className="h-8 min-w-56 text-xs">
        <SelectValue placeholder="Pick a transaction" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Unmatched</SelectItem>
        {candidates.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {formatDate(c.postedAt)} · {c.merchant ?? c.description} ·{' '}
            {formatUsd(c.amountCents)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
