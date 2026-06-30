import { FileText, Search, CircleSlash, ExternalLink } from "lucide-react";
import type { Evidence } from "@/types/audit";

const ICONS = {
  element: Search,
  text: FileText,
  missing: CircleSlash,
} as const;

/**
 * Renders one piece of evidence — the credibility unit of the whole product.
 * Shows what was found (or that something was missing) and links to the exact
 * page it came from.
 */
export function EvidenceLink({ evidence }: { evidence: Evidence }) {
  const Icon = ICONS[evidence.type];
  const isMissing = evidence.type === "missing";

  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
      <Icon
        className={`mt-0.5 size-3.5 shrink-0 ${
          isMissing ? "text-[color:var(--warn)]" : "text-muted-foreground"
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-medium text-foreground">{evidence.location}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {evidence.selectorOrField}
          </span>
        </div>
        {isMissing ? (
          <p className="mt-0.5 text-[color:var(--warn)]">not detected on the store</p>
        ) : (
          evidence.excerpt && (
            <p className="mt-0.5 truncate text-muted-foreground">
              “{evidence.excerpt}”
            </p>
          )
        )}
      </div>
      {evidence.sourceUrl && (
        <a
          href={evidence.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-accent"
          aria-label="Open source page"
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </div>
  );
}
