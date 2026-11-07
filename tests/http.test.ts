import { afterEach, describe, expect, it } from "vitest";
import { corsGuard } from "../lib/http";

const old = process.env.APP_ORIGIN;
afterEach(() => {
  if (old === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = old;
});

describe("mutation Origin protection across HTTPS reverse proxy", () => {
  it("accepts the declared HTTPS public origin even if the gateway URL is private HTTP", () => {
    process.env.APP_ORIGIN = "https://alloc.example.org";
    const request = new Request("http://gateway:3000/api/v1/requests", {
      method: "POST", headers: { Origin: "https://alloc.example.org" },
    });
    expect(() => corsGuard(request)).not.toThrow();
  });

  it("rejects foreign browser origins even when the internal gateway URL differs", () => {
    process.env.APP_ORIGIN = "https://alloc.example.org";
    const request = new Request("http://gateway:3000/api/v1/requests", {
      method: "POST", headers: { Origin: "https://evil.example.org" },
    });
    expect(() => corsGuard(request)).toThrowError(/Cross-origin mutation refused/);
  });

  it("uses actual same origin locally when APP_ORIGIN is absent", () => {
    delete process.env.APP_ORIGIN;
    const ok = new Request("http://localhost:3000/api/v1/requests", {
      method: "POST", headers: { Origin: "http://localhost:3000" },
    });
    const bad = new Request("http://localhost:3000/api/v1/requests", {
      method: "POST", headers: { Origin: "https://elsewhere.example" },
    });
    expect(() => corsGuard(ok)).not.toThrow();
    expect(() => corsGuard(bad)).toThrow();
  });

  it("preserves non-browser API requests without Origin headers", () => {
    process.env.APP_ORIGIN = "https://alloc.example.org";
    expect(() => corsGuard(new Request("http://gateway:3000/api/v1/requests", {
      method: "POST",
    }))).not.toThrow();
  });
});
