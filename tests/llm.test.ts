import { describe, it, expect } from "vitest";
import { TemplateProvider, buildTemplateAudit } from "@/lib/llm/template";
import { validateLlmAudit, parseAuditText, AuditValidationError } from "@/lib/llm/validate";
import { LlmAuditSchema, type StoreEvidence } from "@/types/audit";

function makeEvidence(overrides: Partial<StoreEvidence> = {}): StoreEvidence {
  return {
    url: "https://example.com",
    storeName: "Example",
    homepage: {
      title: "Example Store",
      heroHeadline: "Wildly comfortable shoes",
      heroSubtitle: null,
      primaryCtas: ["Shop now"],
      trustBadges: ["free shipping"],
      navItems: ["Shop", "About"],
      announcement: null,
    },
    products: [
      {
        title: "Tree Runner",
        handle: "tree-runner",
        price: "98.00",
        available: true,
        imagesCount: 5,
        descriptionExcerpt: "Comfortable everyday sneaker.",
        url: "https://example.com/products/tree-runner",
      },
    ],
    collections: [{ title: "Shoes", handle: "shoes", productsCount: 20 }],
    productPageSignals: {
      hasReviews: true,
      hasShippingInfo: true,
      hasReturnsInfo: true,
      hasFaq: true,
      ctaText: "Add to cart",
      sampledProductUrl: "https://example.com/products/tree-runner",
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

describe("TemplateProvider", () => {
  it("always returns a schema-valid audit", async () => {
    const audit = await new TemplateProvider().analyze(makeEvidence());
    expect(() => LlmAuditSchema.parse(audit)).not.toThrow();
    expect(audit.opportunities.length).toBeGreaterThan(0);
  });

  it("flags missing reviews as a PDP opportunity", () => {
    const audit = buildTemplateAudit(
      makeEvidence({
        productPageSignals: {
          hasReviews: false,
          hasShippingInfo: true,
          hasReturnsInfo: true,
          hasFaq: false,
          ctaText: null,
          sampledProductUrl: "https://example.com/products/tree-runner",
        },
      }),
    );
    const reviewsOpp = audit.opportunities.find((o) =>
      o.title.toLowerCase().includes("social proof"),
    );
    expect(reviewsOpp).toBeDefined();
    expect(reviewsOpp!.evidence[0].type).toBe("missing");
  });

  it("does NOT invent problems when page HTML could not be fetched", () => {
    const audit = buildTemplateAudit(
      makeEvidence({
        sourceFlags: {
          productsJson: true,
          collectionsJson: true,
          homepageHtml: false,
          productPageHtml: false,
        },
        productPageSignals: {
          hasReviews: null,
          hasShippingInfo: null,
          hasReturnsInfo: null,
          hasFaq: null,
          ctaText: null,
          sampledProductUrl: null,
        },
      }),
    );
    // None of the homepage/PDP-gated opportunities should fire on unfetched data.
    const fabricated = audit.opportunities.find(
      (o) => o.category === "Trust" || o.title.includes("social proof"),
    );
    expect(fabricated).toBeUndefined();
    expect(audit.summary).toMatch(/could not be fetched/i);
  });

  it("produces an opportunity even on a clean store", async () => {
    const audit = await new TemplateProvider().analyze(makeEvidence());
    expect(audit.opportunities.length).toBeGreaterThanOrEqual(1);
  });
});

describe("validateLlmAudit", () => {
  it("accepts a valid template audit", () => {
    const audit = buildTemplateAudit(makeEvidence());
    expect(() => validateLlmAudit(audit)).not.toThrow();
  });

  it("throws AuditValidationError on bad data", () => {
    expect(() => validateLlmAudit({ summary: 123 })).toThrow(AuditValidationError);
  });
});

describe("parseAuditText", () => {
  it("strips a ```json fence and parses", () => {
    const audit = buildTemplateAudit(makeEvidence());
    const fenced = "```json\n" + JSON.stringify(audit) + "\n```";
    expect(parseAuditText(fenced)).not.toBeNull();
  });

  it("returns null on unparseable text", () => {
    expect(parseAuditText("not json at all")).toBeNull();
  });
});
