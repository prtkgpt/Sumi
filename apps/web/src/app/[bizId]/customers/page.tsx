import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import { getDb, customers } from '@sumi/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requireBusiness } from '@/lib/auth/require-business';

export default async function CustomersPage({
  params,
}: {
  params: Promise<{ bizId: string }>;
}) {
  const { bizId } = await params;
  const { business } = await requireBusiness(bizId);
  const db = getDb();

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
      isArchived: customers.isArchived,
    })
    .from(customers)
    .where(eq(customers.businessId, business.id))
    .orderBy(asc(customers.name));

  const active = rows.filter((r) => !r.isArchived);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            People and businesses you invoice.
          </p>
        </div>
        <Button asChild>
          <Link href={`/${business.id}/customers/new`}>
            <Plus className="size-4" />
            Add customer
          </Link>
        </Button>
      </div>

      {active.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <h2 className="text-xl font-semibold tracking-tight">
              No customers yet
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Add a customer to start sending invoices.
            </p>
            <Button asChild className="mt-2">
              <Link href={`/${business.id}/customers/new`}>Add customer</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.phone ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/${business.id}/customers/${c.id}`}>
                        Edit
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
