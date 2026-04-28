'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createInvoice,
  updateInvoice,
  type InvoiceFormState,
} from './actions';

const initial: InvoiceFormState = {};

type CustomerOption = { id: string; name: string };
type LineItemDraft = {
  description: string;
  quantity: string;
  unitPriceDollars: string;
};
type InvoiceDraft = {
  id: string;
  customerId: string;
  issuedAt: string;
  dueAt: string;
  notes: string | null;
  lineItems: LineItemDraft[];
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const dueIso = (offsetDays: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const emptyLine: LineItemDraft = {
  description: '',
  quantity: '1',
  unitPriceDollars: '',
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : label}
    </Button>
  );
}

function lineTotal(li: LineItemDraft): number {
  const q = Number(li.quantity || '0');
  const p = Number(li.unitPriceDollars || '0');
  if (Number.isNaN(q) || Number.isNaN(p)) return 0;
  return q * p;
}

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

export function InvoiceForm({
  bizId,
  customers,
  invoice,
}: {
  bizId: string;
  customers: CustomerOption[];
  invoice?: InvoiceDraft;
}) {
  const action = invoice ? updateInvoice : createInvoice;
  const [state, formAction] = useActionState(action, initial);
  const [customerId, setCustomerId] = useState(
    invoice?.customerId ?? customers[0]?.id ?? ''
  );
  const [lines, setLines] = useState<LineItemDraft[]>(
    invoice?.lineItems.length ? invoice.lineItems : [emptyLine]
  );

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  const total = lines.reduce((sum, li) => sum + lineTotal(li), 0);

  const updateLine = (
    idx: number,
    field: keyof LineItemDraft,
    value: string
  ) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    );
  };

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="bizId" value={bizId} />
      {invoice && <input type="hidden" name="invoiceId" value={invoice.id} />}
      <input type="hidden" name="customerId" value={customerId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-3">
          <Label htmlFor="customer-select">Customer</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger id="customer-select">
              <SelectValue placeholder="Pick a customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="issuedAt">Issue date</Label>
          <Input
            id="issuedAt"
            name="issuedAt"
            type="date"
            required
            defaultValue={invoice?.issuedAt ?? todayIso()}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dueAt">Due date</Label>
          <Input
            id="dueAt"
            name="dueAt"
            type="date"
            required
            defaultValue={invoice?.dueAt ?? dueIso(14)}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Line items</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((p) => [...p, { ...emptyLine }])}
          >
            <Plus className="size-4" />
            Add line
          </Button>
        </div>

        <div className="space-y-2">
          {lines.map((li, idx) => (
            <div
              key={idx}
              className="grid grid-cols-12 items-center gap-2 rounded-md border p-2"
            >
              <Input
                name="lineItems.description"
                value={li.description}
                onChange={(e) => updateLine(idx, 'description', e.target.value)}
                placeholder="Description"
                className="col-span-6"
                required
                maxLength={500}
              />
              <Input
                name="lineItems.quantity"
                value={li.quantity}
                onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                placeholder="Qty"
                className="col-span-2"
                inputMode="decimal"
                required
              />
              <Input
                name="lineItems.unitPrice"
                value={li.unitPriceDollars}
                onChange={(e) =>
                  updateLine(idx, 'unitPriceDollars', e.target.value)
                }
                placeholder="$"
                className="col-span-2"
                inputMode="decimal"
                required
              />
              <div className="col-span-1 text-right text-sm font-medium tabular-nums text-muted-foreground">
                {formatUsd(lineTotal(li))}
              </div>
              <div className="col-span-1 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((p) => p.filter((_, i) => i !== idx))
                  }
                  aria-label="Remove line"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Total
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatUsd(total)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={invoice?.notes ?? ''}
          placeholder="Visible on the customer's invoice."
        />
      </div>

      <div className="flex justify-end">
        <SubmitButton label={invoice ? 'Save invoice' : 'Create invoice'} />
      </div>
    </form>
  );
}
