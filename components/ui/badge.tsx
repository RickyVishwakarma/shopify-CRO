import { cn } from "@/lib/utils";

type Variant = "default" | "muted" | "outline" | "good" | "warn" | "bad" | "accent";

const variants: Record<Variant, string> = {
  default: "bg-muted text-foreground",
  muted: "bg-transparent text-muted-foreground border border-border",
  outline: "bg-transparent text-foreground border border-border",
  good: "bg-[color:var(--good)]/12 text-[color:var(--good)] border border-[color:var(--good)]/25",
  warn: "bg-[color:var(--warn)]/12 text-[color:var(--warn)] border border-[color:var(--warn)]/25",
  bad: "bg-[color:var(--bad)]/12 text-[color:var(--bad)] border border-[color:var(--bad)]/25",
  accent:
    "bg-accent-soft text-[color:var(--accent)] border border-[color:var(--accent)]/20",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
