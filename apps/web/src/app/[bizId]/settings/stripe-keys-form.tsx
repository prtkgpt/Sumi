'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  updateStripeKeys,
  clearStripeKeys,
  type StripeKeysState,
} from './actions';

const initial: StripeKeysState = {};

export type StripeStatus = {
  configured: boolean;
  accountId: string | null;
  webhookUrl: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Verifying with Stripe…' : label}
    </Button>
  );
}

export function StripeKeysForm({
  bizId,
  status,
}: {
  bizId: string;
  status: StripeStatus;
}) {
  const [state, formAction] = useActionState(updateStripeKeys, initial);
  const [editing, setEditing] = useState(!status.configured);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) {
      toast.success(`Stripe connected · ${state.accountId ?? ''}`.trim());
      setEditing(false);
    }
  }, [state]);

  if (status.configured && !editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 dark:bg-emerald-950/20">
          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
          <div className="flex-1">
            <p className="text-sm font-medium">Stripe is connected</p>
            <p className="text-xs text-muted-foreground">
              Account: <code>{status.accountId ?? '(unknown)'}</code>
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Webhook URL</Label>
          <Input value={status.webhookUrl} readOnly className="font-mono text-xs" />
          <p className="text-xs text-muted-foreground">
            Stripe should be sending checkout.session.completed events here.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            Replace keys
          </Button>
          <form action={clearStripeKeys}>
            <input type="hidden" name="bizId" value={bizId} />
            <Button type="submit" variant="ghost">
              Disconnect Stripe
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="bizId" value={bizId} />

      <div className="space-y-2">
        <Label htmlFor="secretKey">Stripe secret key</Label>
        <Input
          id="secretKey"
          name="secretKey"
          required
          autoComplete="off"
          placeholder="sk_test_… or sk_live_…"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Get this from{' '}
          <a
            href="https://dashboard.stripe.com/apikeys"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            dashboard.stripe.com/apikeys
          </a>
          . Stored encrypted.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="webhookSecret">Webhook signing secret</Label>
        <Input
          id="webhookSecret"
          name="webhookSecret"
          required
          autoComplete="off"
          placeholder="whsec_…"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          In Stripe → Developers → Webhooks, create an endpoint at this URL
          and copy the signing secret:
        </p>
        <Input
          value={status.webhookUrl}
          readOnly
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Subscribe to <code>checkout.session.completed</code>.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <SubmitButton
          label={status.configured ? 'Save new keys' : 'Connect Stripe'}
        />
        {status.configured && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
