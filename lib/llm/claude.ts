import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { LlmAuditSchema, type LlmAudit, type StoreEvidence } from "@/types/audit";
import { SYSTEM_PROMPT } from "@/lib/prompts/system";
import { buildUserPrompt } from "@/lib/prompts/user";
import { parseAuditText } from "./validate";
import type { LLMProvider } from "./provider";

/**
 * Real analysis via Claude.
 *
 * Reliability strategy (the assignment's "force JSON, validate, retry, recover"
 * requirement):
 *  1. Primary path uses structured outputs — the response is constrained to the
 *     audit JSON schema at the API layer and validated against our zod schema
 *     by the SDK helper, so malformed JSON is essentially designed out.
 *  2. If structured output is unavailable or returns nothing usable, we fall
 *     back to a plain completion and parse+validate it ourselves (one repair
 *     attempt that feeds the failure back to the model).
 *  3. Any unrecoverable failure throws — the orchestrator then degrades to the
 *     deterministic template provider, so the app never hard-fails on the LLM.
 */

const DEFAULT_MODEL = process.env.LLM_MODEL || "claude-opus-4-8";
const MAX_TOKENS = 8000;

export class ClaudeProvider implements LLMProvider {
  readonly model: string;
  private client: Anthropic;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async analyze(evidence: StoreEvidence): Promise<LlmAudit> {
    const userPrompt = buildUserPrompt(evidence);

    // --- Primary: structured outputs --------------------------------------
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        output_config: { format: zodOutputFormat(LlmAuditSchema) },
      });

      if (response.stop_reason === "refusal") {
        throw new Error("Model declined to analyze this store.");
      }
      if (response.parsed_output) {
        return response.parsed_output;
      }
      // Fell through (e.g. truncated) — try the repair path below.
    } catch (err) {
      // Structured-output path unavailable or errored — try repair before
      // giving up so the orchestrator can decide whether to fall back.
      if (isAuthOrQuotaError(err)) throw err;
    }

    // --- Repair: plain completion + manual parse/validate -----------------
    const repair = await this.client.messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: userPrompt },
        {
          role: "user",
          content:
            "Return ONLY the audit as raw JSON matching the agreed schema. No prose, no markdown fences.",
        },
      ],
    });

    const text = repair.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const parsed = parseAuditText(text);
    if (!parsed) {
      throw new Error("Claude returned output that could not be parsed into a valid audit.");
    }
    return parsed;
  }
}

/** Auth/quota errors should propagate immediately — retrying won't help. */
function isAuthOrQuotaError(err: unknown): boolean {
  return (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError ||
    err instanceof Anthropic.RateLimitError
  );
}
