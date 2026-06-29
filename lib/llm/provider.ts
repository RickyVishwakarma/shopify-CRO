import type { LlmAudit, StoreEvidence } from "@/types/audit";

/**
 * The LLM is a swappable dependency. Both the real Claude provider and the
 * deterministic fallback implement this interface, which makes the analysis
 * step trivially mockable in tests and lets the orchestrator treat "with a key"
 * and "without a key" identically.
 */
export interface LLMProvider {
  /** Human-readable model/provider id, surfaced in the audit. */
  readonly model: string;
  /** Produce a raw (unscored) audit from scraped evidence, or throw. */
  analyze(evidence: StoreEvidence): Promise<LlmAudit>;
}
