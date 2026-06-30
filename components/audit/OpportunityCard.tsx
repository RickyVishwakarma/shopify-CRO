"use client";

import { useState } from "react";
import {
  ChevronDown,
  FlaskConical,
  Target,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge, MetricChip } from "./ScoreBadge";
import { EvidenceLink } from "./EvidenceLink";
import { cn } from "@/lib/utils";
import type { Opportunity } from "@/types/audit";

export function OpportunityCard({
  opportunity: o,
  rank,
}: {
  opportunity: Opportunity;
  rank: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="overflow-hidden transition-colors hover:bg-card-hover">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                #{rank}
              </span>
              <Badge variant="muted">{o.category}</Badge>
              {!o.grounded && (
                <Badge variant="warn">
                  <AlertTriangle className="size-3" /> unverified evidence
                </Badge>
              )}
            </div>
            <h3 className="text-base font-semibold leading-snug text-foreground">
              {o.title}
            </h3>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              priority
            </span>
            <ScoreBadge score={o.priorityScore} />
          </div>
        </div>

        {/* Metrics */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <MetricChip label="impact" value={`${o.impact}/5`} />
          <MetricChip label="confidence" value={o.confidence.toFixed(2)} />
          <MetricChip label="effort" value={`${o.effort}/5`} />
        </div>

        {/* Problem */}
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {o.problem}
        </p>

        {/* Evidence */}
        <div className="mt-3 space-y-1.5">
          {o.evidence.map((e, i) => (
            <EvidenceLink key={i} evidence={e} />
          ))}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn("size-3.5 transition-transform", open && "rotate-180")}
          />
          {open ? "Hide" : "Show"} reasoning &amp; experiment
        </button>
      </div>

      {/* Expandable detail */}
      {open && (
        <div className="space-y-4 border-t border-border bg-muted/30 p-5">
          <Section icon={<Lightbulb className="size-3.5" />} title="Reasoning">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {o.reasoning}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <span className="text-foreground">Business impact: </span>
              {o.businessImpact}
            </p>
          </Section>

          <Section icon={<FlaskConical className="size-3.5" />} title="Experiment brief">
            <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[7rem_1fr]">
              <Row label="Hypothesis" value={o.experiment.hypothesis} />
              <Row label="Metric" value={o.experiment.metric} />
              <Row label="Expected" value={o.experiment.expectedImpact} />
              <Row label="Effort" value={o.experiment.effort} />
              <Row label="Implementation" value={o.experiment.implementation} />
            </dl>
          </Section>

          <Section icon={<Target className="size-3.5" />} title="Success metric">
            <p className="text-sm text-muted-foreground">{o.successMetric}</p>
          </Section>
        </div>
      )}
    </Card>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </>
  );
}
