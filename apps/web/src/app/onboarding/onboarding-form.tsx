'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBusiness, type CreateBusinessState } from './actions';

const initialState: CreateBusinessState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating…' : 'Continue'}
    </Button>
  );
}

export function OnboardingForm() {
  const [state, formAction] = useActionState(createBusiness, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="legalName">What&apos;s your business name?</Label>
        <Input
          id="legalName"
          name="legalName"
          required
          autoFocus
          maxLength={120}
          placeholder="Acme Coffee Co."
        />
      </div>
      <SubmitButton />
    </form>
  );
}
