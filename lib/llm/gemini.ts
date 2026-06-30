import type { LlmAudit, StoreEvidence } from "@/types/audit";
import { SYSTEM_PROMPT } from "@/lib/prompts/system";
import { buildUserPrompt } from "@/lib/prompts/user";
import { parseAuditText } from "./validate";
import type { LLMProvider } from "./provider";

/**
 * Free real-LLM path via Google's Gemini API.
 *
 * Uses the REST endpoint directly (no SDK dependency). We force JSON output
 * with responseMimeType, then parse + validate with the same zod guard the
 * Claude path uses, with one repair retry. This exists because the brief asks
 * for provider flexibility ("Claude API or an abstraction"), and because a free
 * provider lets the model-driven path be demonstrated without paid credit.
 */

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  promptFeedback?: { blockReason?: string };
}

export class GeminiProvider implements LLMProvider {
  readonly model: string;
  private apiKey: string;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async analyze(evidence: StoreEvidence): Promise<LlmAudit> {
    const userPrompt = buildUserPrompt(evidence);

    const first = await this.call(userPrompt);
    const parsed = parseAuditText(first);
    if (parsed) return parsed;

    // One repair attempt: hand the model back its own output with the failure.
    const repair = await this.call(
      `${userPrompt}\n\nYour previous response was not valid JSON for the audit schema. Return ONLY the audit as a single valid JSON object — no markdown, no commentary.`,
    );
    const repaired = parseAuditText(repair);
    if (!repaired) {
      throw new Error("Gemini returned output that could not be parsed into a valid audit.");
    }
    return repaired;
  }

  /** One generateContent call returning the raw text candidate. */
  private async call(userPrompt: string): Promise<string> {
    const res = await fetch(
      `${ENDPOINT}/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3,
            // Generous budget: Gemini 2.5's internal "thinking" also draws from
            // this, so a tight cap can truncate the JSON.
            maxOutputTokens: 16000,
          },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as GeminiResponse;
    if (data.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked the request: ${data.promptFeedback.blockReason}`);
    }

    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");
    if (!text) throw new Error("Gemini returned an empty response.");
    return text;
  }
}
