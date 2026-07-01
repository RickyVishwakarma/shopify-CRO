import Link from "next/link";
import { Gauge, ExternalLink } from "lucide-react";

/** Slim, sticky top bar shown on every page — gives the tool an app-like frame. */
export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gauge className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            CRO Engine
          </span>
        </Link>
        <a
          href="https://github.com/RickyVishwakarma/shopify-CRO"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          GitHub
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </header>
  );
}
