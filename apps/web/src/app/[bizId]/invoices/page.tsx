import { requireBusiness } from '@/lib/auth/require-business';
import { EmptyState } from '@/components/empty-state';

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ bizId: string }>;
}) {
  const { bizId } = await params;
  await requireBusiness(bizId);
  return <EmptyState title="Coming soon" />;
}
