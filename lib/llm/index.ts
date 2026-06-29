import type { LlmAudit, StoreEvidence } from "@/types/audit";
import { ClaudeProvider } from "./claude";
import { TemplateProvider } from "./template";
import { validateLlmAudit } from "./validate";

export { validateLlmAudit, AuditValidationError } from "./validate";
export type { LLMProvider } from "./provider";

export interface AnalysisResult {
  audit: LlmAudit;
  /** The model/provider that produced it. */
  model: string;
  /** True when the deterministic fallback produced the audit. */
  fallback: boolean;
}

/**
 * Run the analysis with graceful degradation:
 *  - If an API key is configured, try Claude first.
 *  - On any Claude failure (no key, auth, quota, malformed output), fall back
 *    to the deterministic template provider.
 *  - Every audit — model or template — passes the same schema validation before
 *    it's returned. We don't trust our own fallback any more than the model.
 */
export async function analyzeStore(evidence: StoreEvidence): Promise<AnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    try {
      const claude = new ClaudeProvider(apiKey);
      const audit = validateLlmAudit(await claude.analyze(evidence));
      return { audit, model: claude.model, fallback: false };
    } catch (err) {
      console.warn(
        `[llm] Claude analysis failed; falling back to template. Reason: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  const template = new TemplateProvider();
  const audit = validateLlmAudit(await template.analyze(evidence));
  return { audit, model: template.model, fallback: true };
}
