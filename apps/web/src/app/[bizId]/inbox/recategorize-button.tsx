'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  recategorizeUncategorized,
  type RecategorizeState,
} from '../transactions/actions';

const initial: RecategorizeState = {};

function Inner({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="sm"
      disabled={disabled || pending}
      className="gap-1"
    >
      <Sparkles className="size-4" />
      {pending ? 'Categorizing…' : 'Categorize uncategorized'}
    </Button>
  );
}

export function RecategorizeButton({
  bizId,
  uncategorizedCount,
}: {
  bizId: string;
  uncategorizedCount: number;
}) {
  const [state, formAction] = useActionState(
    recategorizeUncategorized,
    initial
  );

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
      return;
    }
    const total =
      (state.ruleHits ?? 0) + (state.llmHits ?? 0) + (state.llmMisses ?? 0);
    if (state.scanned !== undefined && total > 0) {
      const ai = state.llmHits ?? 0;
      const rule = state.ruleHits ?? 0;
      const skipped = state.llmMisses ?? 0;
      toast.success(
        `Categorized ${ai + rule} of ${state.scanned} (${rule} rule, ${ai} AI)${
          skipped > 0 ? `, ${skipped} low-confidence` : ''
        }.`
      );
    } else if (state.scanned === 0) {
      toast.info('No uncategorized transactions to process.');
    }
  }, [state]);

  if (uncategorizedCount === 0) return null;

  return (
    <form action={formAction}>
      <input type="hidden" name="bizId" value={bizId} />
      <Inner disabled={false} />
    </form>
  );
}
