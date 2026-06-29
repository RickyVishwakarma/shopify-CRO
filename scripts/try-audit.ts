/* Full pipeline smoke test. Run: npx tsx scripts/try-audit.ts [url] */
import { validateStoreUrl } from "@/lib/validation/url";
import { scrapeStore } from "@/lib/scraper";
import { analyzeStore } from "@/lib/llm";
import { rankOpportunities } from "@/lib/analysis/scoring";

async function main() {
  const input = process.argv[2] ?? "https://drsquatch.com";
  const { normalized, hostname } = validateStoreUrl(input);

  console.log(`\nAuditing ${normalized} …`);
  const evidence = await scrapeStore(normalized, hostname);
  const { audit, model, fallback } = await analyzeStore(evidence);
  const ranked = rankOpportunities(audit.opportunities, evidence);

  console.log(`\nmodel: ${model}${fallback ? "  (fallback — no API key)" : ""}`);
  console.log(`\nEXECUTIVE SUMMARY:\n${audit.executiveSummary}`);
  console.log(`\nSTRENGTHS:`);
  for (const s of audit.strengths) console.log(`  + ${s}`);

  console.log(`\nTOP OPPORTUNITIES (ranked by priority):`);
  for (const o of ranked.slice(0, 6)) {
    console.log(
      `\n  [${o.priorityScore}] ${o.title}  (${o.category})  ${
        o.grounded ? "" : "⚠ ungrounded"
      }`,
    );
    console.log(`      impact ${o.impact}/5 · confidence ${o.confidence} · effort ${o.effort}/5`);
    console.log(`      problem: ${o.problem}`);
    console.log(`      evidence: ${o.evidence.map((e) => `${e.type}:${e.selectorOrField}`).join(", ")}`);
    console.log(`      experiment: ${o.experiment.hypothesis}`);
  }
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
