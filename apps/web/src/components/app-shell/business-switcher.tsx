'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type BusinessSummary = {
  id: string;
  legalName: string;
};

export function BusinessSwitcher({
  current,
  options,
}: {
  current: BusinessSummary;
  options: BusinessSummary[];
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2 font-medium">
          <span className="max-w-[180px] truncate">{current.legalName}</span>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Businesses</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((b) => {
          const isCurrent = b.id === current.id;
          return (
            <DropdownMenuItem
              key={b.id}
              onSelect={() => {
                if (!isCurrent) router.push(`/${b.id}/dashboard`);
              }}
              className="flex items-center justify-between"
            >
              <span className="truncate">{b.legalName}</span>
              {isCurrent && <Check className="size-4" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding" className="flex items-center gap-2">
            <Plus className="size-4" />
            New business
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
