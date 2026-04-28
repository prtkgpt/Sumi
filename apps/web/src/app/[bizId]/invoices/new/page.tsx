import Link from 'next/link';
import { asc, eq, and } from 'drizzle-orm';
import { getDb, customers } from '@sumi/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { requireBusiness } from '@/lib/auth/require-business';
import { InvoiceForm } from '../invoice-form';

export default async function NewInvoicePage({
  params,
}: {
  params: Promise<{ bizId: string }>;
}) {
  const { bizId } = await params;
  const { business } = await requireBusiness(bizId);
  const db = getDb();

  const customerRows = await db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(
      and(
        eq(customers.businessId, business.id),
        eq(customers.isArchived, false)
      )
    )
    .orderBy(asc(customers.name));

  if (customerRows.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <h2 className="text-lg font-semibold">Add a customer first</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              You need at least one customer before you can create an invoice.
            </p>
            <Button asChild className="mt-2">
              <Link href={`/${business.id}/customers/new`}>Add customer</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Bill a customer with itemized line items.
      </p>
      <div className="mt-8">
        <InvoiceForm bizId={business.id} customers={customerRows} />
      </div>
    </div>
  );
}
