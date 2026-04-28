'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  usePlaidLink,
  type PlaidLinkOnSuccess,
  type PlaidLinkOptions,
} from 'react-plaid-link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

async function fetchLinkToken(bizId: string): Promise<string> {
  const r = await fetch('/api/plaid/link-token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bizId }),
  });
  if (!r.ok) throw new Error('Failed to start Plaid Link');
  const j = (await r.json()) as { link_token: string };
  return j.link_token;
}

async function exchange(bizId: string, publicToken: string, metadata: unknown) {
  const r = await fetch('/api/plaid/exchange', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      bizId,
      public_token: publicToken,
      institution: (metadata as { institution?: unknown })?.institution,
    }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Exchange failed: ${text}`);
  }
}

export function ConnectBankButton({ bizId }: { bizId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const initiatedRef = useRef(false);

  const onSuccess: PlaidLinkOnSuccess = useCallback(
    async (publicToken, metadata) => {
      try {
        setLoading(true);
        await exchange(bizId, publicToken, metadata);
        toast.success('Bank connected. Pulling transactions…');
        router.refresh();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [bizId, router]
  );

  const config: PlaidLinkOptions = {
    token,
    onSuccess,
  };
  const { open, ready } = usePlaidLink(config);

  useEffect(() => {
    if (!initiatedRef.current) return;
    if (token && ready) {
      open();
      initiatedRef.current = false;
    }
  }, [token, ready, open]);

  const handleClick = useCallback(async () => {
    try {
      setLoading(true);
      initiatedRef.current = true;
      const t = await fetchLinkToken(bizId);
      setToken(t);
    } catch (e) {
      initiatedRef.current = false;
      const message = e instanceof Error ? e.message : 'Unknown error';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [bizId]);

  return (
    <Button onClick={handleClick} disabled={loading}>
      {loading ? 'Connecting…' : 'Connect bank'}
    </Button>
  );
}
