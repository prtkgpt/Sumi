'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { setTransactionCategory } from '../transactions/actions';

type CategoryOption = {
  id: string;
  kind: string;
  displayName: string;
};

const NONE = 'none';

export function CategoryPicker({
  bizId,
  transactionId,
  currentCategoryId,
  categories,
}: {
  bizId: string;
  transactionId: string;
  currentCategoryId: string | null;
  categories: CategoryOption[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const expense = categories.filter((c) => c.kind === 'expense');
  const income = categories.filter((c) => c.kind === 'income');
  const other = categories.filter(
    (c) => c.kind !== 'expense' && c.kind !== 'income'
  );

  return (
    <Select
      value={currentCategoryId ?? NONE}
      disabled={pending}
      onValueChange={(value) => {
        startTransition(async () => {
          try {
            const fd = new FormData();
            fd.set('bizId', bizId);
            fd.set('transactionId', transactionId);
            fd.set('categoryId', value === NONE ? '' : value);
            await setTransactionCategory(fd);
            router.refresh();
          } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            toast.error(message);
          }
        });
      }}
    >
      <SelectTrigger className="h-8 w-44 text-xs">
        <SelectValue placeholder="Uncategorized" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Uncategorized</SelectItem>
        {expense.length > 0 && (
          <SelectGroup>
            <SelectLabel>Expense</SelectLabel>
            {expense.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.displayName}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {income.length > 0 && (
          <SelectGroup>
            <SelectLabel>Income</SelectLabel>
            {income.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.displayName}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {other.length > 0 && (
          <SelectGroup>
            <SelectLabel>Other</SelectLabel>
            {other.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.displayName}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
