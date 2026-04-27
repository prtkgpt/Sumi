import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function KpiTile({
  label,
  value,
  caption,
  tone = 'default',
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: 'default' | 'positive' | 'negative' | 'muted';
}) {
  return (
    <Card>
      <CardContent className="space-y-1 py-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            'text-2xl font-semibold tabular-nums tracking-tight',
            tone === 'positive' && 'text-emerald-600 dark:text-emerald-400',
            tone === 'negative' && 'text-rose-600 dark:text-rose-400',
            tone === 'muted' && 'text-muted-foreground'
          )}
        >
          {value}
        </p>
        {caption && (
          <p className="text-xs text-muted-foreground">{caption}</p>
        )}
      </CardContent>
    </Card>
  );
}
