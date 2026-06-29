import { describe, it, expect } from "vitest";
import {
  validateStoreUrl,
  isPrivateHost,
  UrlValidationError,
} from "@/lib/validation/url";

describe("validateStoreUrl", () => {
  it("accepts a full https URL", () => {
    const r = validateStoreUrl("https://gymshark.com");
    expect(r.hostname).toBe("gymshark.com");
    expect(r.normalized).toBe("https://gymshark.com");
  });

  it("adds https:// when the protocol is omitted", () => {
    const r = validateStoreUrl("gymshark.com");
    expect(r.href).toBe("https://gymshark.com/");
    expect(r.normalized).toBe("https://gymshark.com");
  });

  it("lowercases the host and strips path/query for the cache key", () => {
    const r = validateStoreUrl("https://Shop.Example.com/collections/all?ref=x");
    expect(r.normalized).toBe("https://shop.example.com");
  });

  it("rejects empty input", () => {
    expect(() => validateStoreUrl("  ")).toThrowError(UrlValidationError);
    try {
      validateStoreUrl("");
    } catch (e) {
      expect((e as UrlValidationError).code).toBe("empty");
    }
  });

  it("rejects non-http protocols", () => {
    try {
      validateStoreUrl("ftp://example.com");
    } catch (e) {
      expect((e as UrlValidationError).code).toBe("bad_protocol");
    }
  });

  it("rejects bare hostnames without a dot", () => {
    try {
      validateStoreUrl("localhost");
    } catch (e) {
      // localhost is caught as a private host before the dot check
      expect((e as UrlValidationError).code).toBe("private_host");
    }
    try {
      validateStoreUrl("notadomain");
    } catch (e) {
      expect((e as UrlValidationError).code).toBe("bad_host");
    }
  });

  it("blocks SSRF targets", () => {
    const blocked = [
      "http://127.0.0.1",
      "http://localhost:3000",
      "http://169.254.169.254/latest/meta-data/", // cloud metadata
      "http://10.0.0.5",
      "http://192.168.1.1",
      "http://172.16.0.1",
      "http://[::1]",
    ];
    for (const url of blocked) {
      try {
        validateStoreUrl(url);
        throw new Error(`expected ${url} to be rejected`);
      } catch (e) {
        expect(e).toBeInstanceOf(UrlValidationError);
        expect((e as UrlValidationError).code).toBe("private_host");
      }
    }
  });
});

describe("isPrivateHost", () => {
  it("flags private and reserved ranges", () => {
    expect(isPrivateHost("127.0.0.1")).toBe(true);
    expect(isPrivateHost("10.255.255.255")).toBe(true);
    expect(isPrivateHost("172.16.0.1")).toBe(true);
    expect(isPrivateHost("172.32.0.1")).toBe(false); // outside the /12
    expect(isPrivateHost("192.168.0.1")).toBe(true);
    expect(isPrivateHost("169.254.169.254")).toBe(true);
    expect(isPrivateHost("100.64.0.1")).toBe(true); // CGNAT
  });

  it("allows public hosts", () => {
    expect(isPrivateHost("gymshark.com")).toBe(false);
    expect(isPrivateHost("8.8.8.8")).toBe(false);
    expect(isPrivateHost("203.0.113.10")).toBe(false);
  });
});
