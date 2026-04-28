'use client';

import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

export function PayButton({
  token,
  amountCents,
}: {
  token: string;
  amountCents: number;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      size="lg"
      className="w-full"
      disabled={loading}
      onClick={async () => {
        try {
          setLoading(true);
          const r = await fetch(`/api/stripe/checkout`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token }),
          });
          if (!r.ok) {
            const text = await r.text();
            throw new Error(text || 'Could not start checkout');
          }
          const { url } = (await r.json()) as { url: string };
          window.location.href = url;
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Unknown error';
          toast.error(message);
          setLoading(false);
        }
      }}
    >
      <CreditCard className="size-5" />
      {loading ? 'Redirecting…' : `Pay ${formatUsd(amountCents)}`}
    </Button>
  );
}
