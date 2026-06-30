import { Badge } from "@/components/ui/badge";

/** Priority pill, colored by tier. Higher priority = more urgent opportunity. */
export function ScoreBadge({ score }: { score: number }) {
  const variant = score >= 1.5 ? "good" : score >= 0.8 ? "warn" : "muted";
  return (
    <Badge variant={variant} className="font-mono tabular-nums">
      {score.toFixed(2)}
    </Badge>
  );
}

/** Small labeled metric chip (impact / confidence / effort). */
export function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
      <span className="uppercase tracking-wide">{label}</span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </span>
  );
}
