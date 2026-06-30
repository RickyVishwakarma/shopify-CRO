import type { LlmAudit, StoreEvidence } from "@/types/audit";
import { ClaudeProvider } from "./claude";
import { GeminiProvider } from "./gemini";
import { TemplateProvider } from "./template";
import { validateLlmAudit } from "./validate";
import type { LLMProvider } from "./provider";

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
 * Build the ordered list of real LLM providers from whatever keys are present.
 * Claude is preferred (the documented default); Gemini is a free secondary so
 * the model-driven path works without paid credit. Either can be the only one
 * configured — or neither, in which case we use the deterministic fallback.
 */
function realProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push(new ClaudeProvider(process.env.ANTHROPIC_API_KEY));
  }
  if (process.env.GEMINI_API_KEY) {
    providers.push(new GeminiProvider(process.env.GEMINI_API_KEY));
  }
  return providers;
}

/**
 * Run the analysis with graceful degradation: try each configured real
 * provider in priority order, and if all fail (or none are configured) fall
 * back to the deterministic template provider. Every audit — from any source —
 * passes the same schema validation before it's returned; we don't trust our
 * own fallback any more than we trust the model.
 */
export async function analyzeStore(evidence: StoreEvidence): Promise<AnalysisResult> {
  for (const provider of realProviders()) {
    try {
      const audit = validateLlmAudit(await provider.analyze(evidence));
      return { audit, model: provider.model, fallback: false };
    } catch (err) {
      console.warn(
        `[llm] ${provider.model} analysis failed; trying next provider. Reason: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  const template = new TemplateProvider();
  const audit = validateLlmAudit(await template.analyze(evidence));
  return { audit, model: template.model, fallback: true };
}
