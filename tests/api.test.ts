import { describe, it, expect, vi } from "vitest";

// Mock the orchestrator so the success case doesn't do real network work.
// runAudit defaults to the REAL implementation, so URL-validation errors (which
// throw synchronously, before any network call) exercise the true code path;
// only the success test overrides it.
vi.mock("@/lib/orchestrator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/orchestrator")>();
  return { ...actual, runAudit: vi.fn(actual.runAudit) };
});

import { POST } from "@/app/api/audits/route";
import { runAudit } from "@/lib/orchestrator";
import type { NextRequest } from "next/server";

const mockRunAudit = vi.mocked(runAudit);

function postRequest(body: unknown, raw = false): NextRequest {
  return new Request("http://localhost/api/audits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/audits", () => {
  it("returns 200 and the audit on success", async () => {
    mockRunAudit.mockResolvedValueOnce({ id: "aud_123", storeName: "Demo" } as never);
    const res = await POST(postRequest({ url: "https://drsquatch.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "aud_123" });
    expect(mockRunAudit).toHaveBeenCalledWith("https://drsquatch.com", { fresh: false });
  });

  it("returns 400 when the url is missing", async () => {
    const res = await POST(postRequest({}));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("bad_request");
  });

  it("returns 400 on invalid JSON body", async () => {
    const res = await POST(postRequest("{not valid json", true));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("bad_request");
  });

  it("rejects SSRF/private hosts with 400 (real validation path)", async () => {
    const res = await POST(postRequest({ url: "http://localhost" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("private_host");
  });

  it("rejects malformed domains with 400 (real validation path)", async () => {
    const res = await POST(postRequest({ url: "notadomain" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("bad_host");
  });
});
