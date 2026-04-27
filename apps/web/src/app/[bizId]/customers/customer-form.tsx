'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createCustomer,
  updateCustomer,
  type CustomerFormState,
} from './actions';

const initial: CustomerFormState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Saving…' : label}
    </Button>
  );
}

export function CustomerForm({
  bizId,
  customer,
}: {
  bizId: string;
  customer?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
  };
}) {
  const action = customer ? updateCustomer : createCustomer;
  const [state, formAction] = useActionState(action, initial);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="bizId" value={bizId} />
      {customer && (
        <input type="hidden" name="customerId" value={customer.id} />
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          autoFocus
          maxLength={200}
          defaultValue={customer?.name ?? ''}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email (optional)</Label>
          <Input
            id="email"
            name="email"
            type="email"
            maxLength={200}
            defaultValue={customer?.email ?? ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input
            id="phone"
            name="phone"
            maxLength={50}
            defaultValue={customer?.phone ?? ''}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={customer?.notes ?? ''}
        />
      </div>

      <SubmitButton label={customer ? 'Save customer' : 'Create customer'} />
    </form>
  );
}
