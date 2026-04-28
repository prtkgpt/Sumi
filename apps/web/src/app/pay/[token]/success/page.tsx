import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default async function PaymentSuccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <CheckCircle2 className="size-12 text-emerald-600 dark:text-emerald-400" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Payment received
          </h1>
          <p className="text-sm text-muted-foreground">
            Your invoice has been paid. A receipt has been emailed to you by
            Stripe.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href={`/pay/${token}`}>View invoice</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
