import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Audit } from "@/types/audit";

export function SummaryHeader({
  audit,
  actions,
}: {
  audit: Audit;
  actions?: React.ReactNode;
}) {
  const scraped = new Date(audit.scrapedAt).toLocaleString();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {audit.fallback ? (
            <Badge variant="warn">fallback engine</Badge>
          ) : (
            <Badge variant="accent">{audit.model}</Badge>
          )}
          <Badge variant="muted">
            {audit.opportunities.length} opportunities
          </Badge>
        </div>
        <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
          {audit.storeName}
        </h1>
        <a
          href={audit.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent"
        >
          {audit.url.replace(/^https?:\/\//, "")}
          <ExternalLink className="size-3.5" />
        </a>
        <p className="mt-1 text-xs text-muted-foreground">Audited {scraped}</p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
