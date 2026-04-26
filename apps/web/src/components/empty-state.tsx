import { Card, CardContent } from '@/components/ui/card';

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
