import { describe, it, expect } from "vitest";
import { priorityScore, isGrounded, rankOpportunities } from "@/lib/analysis/scoring";
import type { LlmOpportunity, StoreEvidence } from "@/types/audit";

function makeEvidence(overrides: Partial<StoreEvidence> = {}): StoreEvidence {
  return {
    url: "https://example.com",
    storeName: "Example",
    homepage: {
      title: "Example Store",
      heroHeadline: "Trusted by 10M+ athletes",
      heroSubtitle: null,
      primaryCtas: ["Shop now"],
      trustBadges: ["Free shipping"],
      navItems: ["Home", "Shop"],
      announcement: null,
    },
    products: [
      {
        title: "Vital Seamless Leggings",
        handle: "vital-seamless-leggings",
        price: "60.00",
        available: true,
        imagesCount: 3,
        descriptionExcerpt: "High-support seamless leggings.",
        url: "https://example.com/products/vital-seamless-leggings",
      },
    ],
    collections: [{ title: "Leggings", handle: "leggings", productsCount: 12 }],
    productPageSignals: {
      hasReviews: false,
      hasShippingInfo: true,
      hasReturnsInfo: null,
      hasFaq: false,
      ctaText: "Add to cart",
      sampledProductUrl: "https://example.com/products/vital-seamless-leggings",
    },
    sourceFlags: {
      productsJson: true,
      collectionsJson: true,
      homepageHtml: true,
      productPageHtml: true,
    },
    ...overrides,
  };
}

function makeOpp(overrides: Partial<LlmOpportunity> = {}): LlmOpportunity {
  return {
    title: "Add reviews to PDP",
    problem: "No social proof on product pages.",
    evidence: [
      {
        type: "missing",
        location: "PDP: Vital Seamless Leggings",
        selectorOrField: "product.reviews",
        excerpt: "",
        sourceUrl: "https://example.com/products/vital-seamless-leggings",
      },
    ],
    businessImpact: "Higher add-to-cart rate.",
    impact: 4,
    confidence: 0.8,
    effort: 2,
    reasoning: "Reviews reduce purchase risk.",
    experiment: {
      hypothesis: "Reviews near ATC lift conversion.",
      metric: "PDP→cart rate",
      expectedImpact: "+3-6%",
      effort: "Low",
      implementation: "Add a reviews app block.",
    },
    successMetric: "PDP→cart conversion",
    category: "PDP",
    ...overrides,
  };
}

describe("priorityScore", () => {
  it("computes (impact × confidence) ÷ effort", () => {
    expect(priorityScore(4, 0.8, 2)).toBe(1.6);
    expect(priorityScore(5, 1, 5)).toBe(1);
    expect(priorityScore(3, 0.5, 3)).toBe(0.5);
  });

  it("floors effort at 1 to avoid divide-by-zero", () => {
    expect(priorityScore(4, 1, 0)).toBe(4);
    expect(priorityScore(4, 1, -3)).toBe(4);
  });

  it("rounds to 2 decimals", () => {
    expect(priorityScore(5, 0.7, 3)).toBe(1.17);
  });
});

describe("isGrounded", () => {
  const corpus =
    "example · example store · trusted by 10m+ athletes · shop now · free shipping · vital seamless leggings · high-support seamless leggings.";

  it("treats missing-type evidence as always grounded", () => {
    expect(isGrounded(makeOpp(), corpus)).toBe(true);
  });

  it("passes when a cited text excerpt is present in the scrape", () => {
    const opp = makeOpp({
      evidence: [
        {
          type: "text",
          location: "Homepage hero",
          selectorOrField: ".hero",
          excerpt: "Trusted by 10M+ athletes",
          sourceUrl: "https://example.com",
        },
      ],
    });
    expect(isGrounded(opp, corpus)).toBe(true);
  });

  it("fails when a cited excerpt is NOT in the scrape (hallucination)", () => {
    const opp = makeOpp({
      evidence: [
        {
          type: "text",
          location: "Homepage hero",
          selectorOrField: ".hero",
          excerpt: "Voted #1 by Forbes 2024",
          sourceUrl: "https://example.com",
        },
      ],
    });
    expect(isGrounded(opp, corpus)).toBe(false);
  });
});

describe("rankOpportunities", () => {
  it("sorts by priority score descending and flags grounding", () => {
    const evidence = makeEvidence();
    const low = makeOpp({ title: "Low priority", impact: 2, confidence: 0.5, effort: 5 });
    const high = makeOpp({ title: "High priority", impact: 5, confidence: 0.9, effort: 1 });
    const hallucinated = makeOpp({
      title: "Hallucinated",
      impact: 3,
      confidence: 0.6,
      effort: 2,
      evidence: [
        {
          type: "text",
          location: "Homepage",
          selectorOrField: ".x",
          excerpt: "this text was never scraped",
          sourceUrl: "https://example.com",
        },
      ],
    });

    const ranked = rankOpportunities([low, high, hallucinated], evidence);

    expect(ranked[0].title).toBe("High priority");
    expect(ranked.map((o) => o.priorityScore)).toEqual(
      [...ranked.map((o) => o.priorityScore)].sort((a, b) => b - a),
    );
    expect(ranked.find((o) => o.title === "Hallucinated")!.grounded).toBe(false);
    expect(ranked.find((o) => o.title === "High priority")!.grounded).toBe(true);
    expect(ranked[0].id).toMatch(/^opp-\d+-/);
  });
});
