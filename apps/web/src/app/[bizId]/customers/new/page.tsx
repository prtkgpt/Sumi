import { requireBusiness } from '@/lib/auth/require-business';
import { CustomerForm } from '../customer-form';

export default async function NewCustomerPage({
  params,
}: {
  params: Promise<{ bizId: string }>;
}) {
  const { bizId } = await params;
  const { business } = await requireBusiness(bizId);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">New customer</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Add a person or business you invoice.
      </p>
      <div className="mt-8">
        <CustomerForm bizId={business.id} />
      </div>
    </div>
  );
}
