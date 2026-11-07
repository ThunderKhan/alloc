import { beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({
  calls: [] as string[],
  rows: ["req-a", "req-b", "req-c", "req-d"].map(request_id => ({request_id})),
  waitOnFirst: false,
  unblock: null as null | (() => void),
}));

vi.mock("../lib/db", () => ({
  db: () => ({
    prepare: (_query: string) => ({
      all: (max: number) => stub.rows.slice(0, max),
    }),
  }),
}));
vi.mock("../lib/payments", () => ({
  reconcile: async (id: string) => {
    stub.calls.push(id);
    if (stub.waitOnFirst && stub.calls.length === 1) {
      await new Promise<void>(resolve => { stub.unblock = resolve; });
    }
  },
}));

import { reconcilePendingCandidates } from "../lib/recovery";

describe("bounded server-side payment reconciliation", () => {
  beforeEach(() => {
    stub.calls.length = 0;
    stub.waitOnFirst = false;
    stub.unblock = null;
  });

  it("checks at most three persisted signatures in one cycle", async () => {
    await reconcilePendingCandidates(1000);
    expect(stub.calls).toEqual(["req-a", "req-b", "req-c"]);
    // All candidates represent existing signed attempts: no new prepare or broadcast.
  });

  it("prevents overlapping sweeps from double-processing the same request", async () => {
    stub.waitOnFirst = true;
    const first = reconcilePendingCandidates();
    await Promise.resolve();
    await reconcilePendingCandidates();
    expect(stub.calls).toEqual(["req-a"]);
    expect(stub.unblock).toBeTypeOf("function");
    stub.unblock!();
    await first;
    expect(stub.calls).toEqual(["req-a", "req-b", "req-c"]);
  });
});
