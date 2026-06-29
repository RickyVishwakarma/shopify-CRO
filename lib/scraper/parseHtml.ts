import * as cheerio from "cheerio";

/**
 * HTML parsing for the parts of a store that aren't in the catalog JSON: the
 * homepage "chrome" (hero, CTAs, trust badges, nav, announcement bar) and
 * conversion signals on a product page (reviews, shipping/returns info, FAQ).
 *
 * These are heuristics, not a theme-specific scraper — Shopify themes vary, so
 * we look for broadly common patterns and degrade gracefully (returning null /
 * empty) when we can't find something. A null here means "couldn't detect,"
 * which downstream is treated as a missing-evidence signal, not a fabrication.
 */

const TRUST_KEYWORDS = [
  "free shipping",
  "free returns",
  "money-back",
  "money back",
  "satisfaction guarantee",
  "secure checkout",
  "secure payment",
  "30-day",
  "60-day",
  "warranty",
  "ssl",
  "as seen",
];

function clean(s: string | undefined | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.map(clean).filter(Boolean))];
}

export interface HomepageParse {
  title: string;
  heroHeadline: string | null;
  heroSubtitle: string | null;
  primaryCtas: string[];
  trustBadges: string[];
  navItems: string[];
  announcement: string | null;
}

export function parseHomepage(html: string): HomepageParse {
  const $ = cheerio.load(html);

  const title = clean($("title").first().text());

  // Hero: first H1 (or a prominent H2 inside a banner/hero section).
  let heroHeadline =
    clean($("h1").first().text()) ||
    clean($('[class*="hero"] h2, [class*="banner"] h2').first().text()) ||
    null;
  if (heroHeadline === "") heroHeadline = null;

  // Subtitle: paragraph near the hero.
  let heroSubtitle =
    clean(
      $('[class*="hero"] p, [class*="banner"] p, h1 + p, h1 ~ p').first().text(),
    ) || null;
  if (heroSubtitle && heroSubtitle.length > 200) {
    heroSubtitle = heroSubtitle.slice(0, 200);
  }
  if (heroSubtitle === "") heroSubtitle = null;

  // Primary CTAs: prominent buttons / button-styled links.
  const ctas = dedupe(
    $(
      'a[class*="button"], button[class*="button"], a.btn, button.btn, a[class*="cta"], [class*="hero"] a',
    )
      .slice(0, 12)
      .map((_, el) => $(el).text())
      .get(),
  )
    .filter((t) => t.length > 0 && t.length < 40)
    .slice(0, 6);

  // Trust badges: any short text node mentioning a trust keyword.
  const bodyText = clean($("body").text()).toLowerCase();
  const trustBadges = TRUST_KEYWORDS.filter((k) => bodyText.includes(k));

  // Nav: links inside the header / primary nav.
  const navItems = dedupe(
    $('header a, nav a, [class*="nav"] a, [class*="menu"] a')
      .slice(0, 30)
      .map((_, el) => $(el).text())
      .get(),
  )
    .filter((t) => t.length > 0 && t.length < 30)
    .slice(0, 12);

  // Announcement bar.
  let announcement =
    clean(
      $(
        '[class*="announcement"], [class*="topbar"], [class*="top-bar"], [class*="promo-bar"]',
      )
        .first()
        .text(),
    ) || null;
  if (announcement && announcement.length > 160) {
    announcement = announcement.slice(0, 160);
  }
  if (announcement === "") announcement = null;

  return {
    title,
    heroHeadline,
    heroSubtitle,
    primaryCtas: ctas,
    trustBadges,
    navItems,
    announcement,
  };
}

export interface ProductPageParse {
  hasReviews: boolean;
  hasShippingInfo: boolean;
  hasReturnsInfo: boolean;
  hasFaq: boolean;
  ctaText: string | null;
}

/** Review-app fingerprints commonly embedded in Shopify product pages. */
const REVIEW_APP_HINTS = [
  "yotpo",
  "judge.me",
  "judgeme",
  "stamped",
  "okendo",
  "loox",
  "reviews.io",
  "shopify-product-reviews",
];

export function parseProductPage(html: string): ProductPageParse {
  const $ = cheerio.load(html);
  const lowerHtml = html.toLowerCase();
  const bodyText = clean($("body").text()).toLowerCase();

  const hasReviews =
    REVIEW_APP_HINTS.some((h) => lowerHtml.includes(h)) ||
    $('[class*="review"], [id*="review"], [data-reviews]').length > 0 ||
    /\d+\s+reviews?/.test(bodyText);

  const hasShippingInfo = /shipping/.test(bodyText);
  const hasReturnsInfo = /return|refund/.test(bodyText);
  const hasFaq = /faq|frequently asked/.test(bodyText);

  // Add-to-cart CTA text.
  const ctaText =
    clean(
      $(
        'button[name="add"], [class*="add-to-cart"], button[class*="cart"], [class*="product-form"] button',
      )
        .first()
        .text(),
    ) || null;

  return {
    hasReviews,
    hasShippingInfo,
    hasReturnsInfo,
    hasFaq,
    ctaText: ctaText || null,
  };
}
