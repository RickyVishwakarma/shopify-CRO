/* Orchestrator + cache smoke test. Run: npx tsx scripts/try-api.ts [url] */
import { runAudit } from "@/lib/orchestrator";

async function main() {
  const url = process.argv[2] ?? "https://drsquatch.com";

  const t1 = Date.now();
  const first = await runAudit(url);
  const ms1 = Date.now() - t1;
  console.log(`First run:  id=${first.id}  ${first.opportunities.length} opps  (${ms1}ms)`);

  const t2 = Date.now();
  const second = await runAudit(url);
  const ms2 = Date.now() - t2;
  console.log(`Cached run: id=${second.id}  (${ms2}ms)`);

  console.log(`\nCache hit returns same id: ${first.id === second.id ? "✅" : "❌"}`);
  console.log(`Cache was ${ms2 < ms1 / 2 ? "✅ much faster" : "⚠ not clearly faster"}`);
  console.log(`\nAudit shape: { id, storeName="${first.storeName}", model="${first.model}", fallback=${first.fallback}, opps=${first.opportunities.length} }`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
