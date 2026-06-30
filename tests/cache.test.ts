import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryCacheStore } from "@/lib/cache/memory";

describe("MemoryCacheStore", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stores and retrieves a value", async () => {
    const c = new MemoryCacheStore();
    await c.set("k", { a: 1 });
    expect(await c.get<{ a: number }>("k")).toEqual({ a: 1 });
  });

  it("returns null for a missing key", async () => {
    const c = new MemoryCacheStore();
    expect(await c.get("nope")).toBeNull();
  });

  it("expires entries after the TTL", async () => {
    const c = new MemoryCacheStore();
    await c.set("k", "v", 1000);
    expect(await c.get("k")).toBe("v");
    vi.advanceTimersByTime(1001);
    expect(await c.get("k")).toBeNull();
  });

  it("uses the default TTL when none is given", async () => {
    const c = new MemoryCacheStore(500);
    await c.set("k", "v");
    vi.advanceTimersByTime(499);
    expect(await c.get("k")).toBe("v");
    vi.advanceTimersByTime(2);
    expect(await c.get("k")).toBeNull();
  });

  it("deletes a key", async () => {
    const c = new MemoryCacheStore();
    await c.set("k", "v");
    await c.delete("k");
    expect(await c.get("k")).toBeNull();
  });
});
