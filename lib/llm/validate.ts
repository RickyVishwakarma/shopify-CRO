import { LlmAuditSchema, type LlmAudit } from "@/types/audit";

export class AuditValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditValidationError";
  }
}

/**
 * Final guard applied to every audit before it leaves the LLM layer —
 * including the output of our own template provider. Nothing reaches scoring or
 * the UI without passing the same schema the model was asked to fill. If the
 * data is off-shape, we fail loudly here rather than corrupt the dashboard.
 */
export function validateLlmAudit(data: unknown): LlmAudit {
  const result = LlmAuditSchema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new AuditValidationError(
      `Audit failed schema validation: ${first?.path.join(".")} — ${first?.message}`,
    );
  }
  return result.data;
}

/**
 * Best-effort parse of raw model text into an audit. Strips a ```json fence if
 * present, then validates. Used as a manual repair path when structured output
 * isn't available. Returns null instead of throwing so callers can retry.
 */
export function parseAuditText(text: string): LlmAudit | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return validateLlmAudit(JSON.parse(cleaned));
  } catch {
    return null;
  }
}
