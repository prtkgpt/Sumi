import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import {
  BusinessSwitcher,
  type BusinessSummary,
} from './business-switcher';
import { MobileSidebar } from './mobile-sidebar';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';

export function AppShell({
  bizId,
  current,
  businesses,
  children,
}: {
  bizId: string;
  current: BusinessSummary;
  businesses: BusinessSummary[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 border-r md:flex md:flex-col">
        <div className="px-5 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Sumi
          </Link>
        </div>
        <Separator />
        <SidebarNav bizId={bizId} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <MobileSidebar bizId={bizId} />
            <BusinessSwitcher current={current} options={businesses} />
          </div>
          <UserMenu />
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
