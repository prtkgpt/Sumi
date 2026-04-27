'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createManualTransaction,
  type CreateManualTransactionState,
} from '../actions';

const initialState: CreateManualTransactionState = {};

type AccountOption = {
  id: string;
  name: string;
  mask: string | null;
  institutionName: string | null;
  kind: string;
};

type CategoryOption = {
  id: string;
  kind: string;
  displayName: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Saving…' : 'Save transaction'}
    </Button>
  );
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export function TransactionForm({
  bizId,
  accounts,
  categories,
}: {
  bizId: string;
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  const [state, formAction] = useActionState(
    createManualTransaction,
    initialState
  );
  const [direction, setDirection] = useState<'inflow' | 'outflow'>('outflow');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState<string>('');

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  const incomeCats = categories.filter((c) => c.kind === 'income');
  const expenseCats = categories.filter((c) => c.kind === 'expense');
  const otherCats = categories.filter(
    (c) => c.kind !== 'income' && c.kind !== 'expense'
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="bizId" value={bizId} />
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="categoryId" value={categoryId} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="postedAt">Date</Label>
          <Input
            id="postedAt"
            name="postedAt"
            type="date"
            required
            defaultValue={todayIso()}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amountDollars">Amount (USD)</Label>
          <div className="flex gap-2">
            <Select
              value={direction}
              onValueChange={(v) => setDirection(v as 'inflow' | 'outflow')}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="outflow">Expense</SelectItem>
                <SelectItem value="inflow">Income</SelectItem>
              </SelectContent>
            </Select>
            <Input
              id="amountDollars"
              name="amountDollars"
              type="text"
              inputMode="decimal"
              required
              placeholder="0.00"
              className="flex-1"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="account-select">Account</Label>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger id="account-select">
            <SelectValue placeholder="Pick an account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
                {a.mask ? ` ··${a.mask}` : ''}
                {a.institutionName ? ` — ${a.institutionName}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category-select">Category (optional)</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger id="category-select">
            <SelectValue placeholder="Pick a category" />
          </SelectTrigger>
          <SelectContent>
            {expenseCats.length > 0 && (
              <SelectGroup>
                <SelectLabel>Expense</SelectLabel>
                {expenseCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.displayName}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {incomeCats.length > 0 && (
              <SelectGroup>
                <SelectLabel>Income</SelectLabel>
                {incomeCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.displayName}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {otherCats.length > 0 && (
              <SelectGroup>
                <SelectLabel>Other</SelectLabel>
                {otherCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.displayName}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="merchant">Merchant (optional)</Label>
        <Input id="merchant" name="merchant" maxLength={200} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" required maxLength={500} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" rows={2} maxLength={2000} />
      </div>

      <SubmitButton />
    </form>
  );
}
