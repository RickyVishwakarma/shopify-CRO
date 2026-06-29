/* Dev-only smoke test for the scraper. Run: npx tsx scripts/try-scrape.ts [url] */
import { validateStoreUrl } from "@/lib/validation/url";
import { scrapeStore } from "@/lib/scraper";

async function main() {
  const input = process.argv[2] ?? "https://gymshark.com";
  const { normalized, hostname } = validateStoreUrl(input);
  console.log(`Scraping ${normalized} …\n`);

  const t = Date.now();
  const ev = await scrapeStore(normalized, hostname);
  const ms = Date.now() - t;

  console.log("storeName:", ev.storeName);
  console.log("sourceFlags:", ev.sourceFlags);
  console.log("\nhomepage:");
  console.log("  hero:", ev.homepage.heroHeadline);
  console.log("  subtitle:", ev.homepage.heroSubtitle);
  console.log("  announcement:", ev.homepage.announcement);
  console.log("  CTAs:", ev.homepage.primaryCtas);
  console.log("  trust badges:", ev.homepage.trustBadges);
  console.log("  nav:", ev.homepage.navItems);
  console.log(`\nproducts: ${ev.products.length} (showing first 3)`);
  for (const p of ev.products.slice(0, 3)) {
    console.log(`  - ${p.title} | ${p.price} | imgs:${p.imagesCount} | ${p.url}`);
  }
  console.log(`\ncollections: ${ev.collections.length} (showing first 5)`);
  for (const c of ev.collections.slice(0, 5)) {
    console.log(`  - ${c.title} (${c.productsCount})`);
  }
  console.log("\nproductPageSignals:", ev.productPageSignals);
  console.log(`\n⏱  scraped in ${ms}ms`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
