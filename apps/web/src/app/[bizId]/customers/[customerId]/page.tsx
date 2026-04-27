import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { getDb, customers } from '@sumi/db';
import { requireBusiness } from '@/lib/auth/require-business';
import { CustomerForm } from '../customer-form';

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ bizId: string; customerId: string }>;
}) {
  const { bizId, customerId } = await params;
  const { business } = await requireBusiness(bizId);
  const db = getDb();

  const [customer] = await db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
      notes: customers.notes,
    })
    .from(customers)
    .where(
      and(eq(customers.id, customerId), eq(customers.businessId, business.id))
    )
    .limit(1);

  if (!customer) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Edit customer</h1>
      <div className="mt-8">
        <CustomerForm bizId={business.id} customer={customer} />
      </div>
    </div>
  );
}
