import { beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({
  calls: [] as string[],
  rows: ["req-a", "req-b", "req-c", "req-d"].map((request_id, i) => ({
    request_id, id: "attempt-" + request_id, prepared_at: i + 1,
  })),
  failIds: [] as string[],
  waitOnFirst: false,
  unblock: null as null | (() => void),
}));

vi.mock("../lib/db", () => ({
  db: () => ({
    prepare: (sql: string) => ({
      all: (...args: Array<string | number>) => {
        const rows = [...stub.rows].sort((a,b) =>
          a.prepared_at - b.prepared_at || a.id.localeCompare(b.id));
        if (sql.includes("(prepared_at, id) > (?, ?)")) {
          const [at, id, max] = args;
          return rows.filter(r => r.prepared_at > Number(at) ||
            (r.prepared_at === Number(at) && r.id > String(id))).slice(0, Number(max));
        }
        if (sql.includes("(prepared_at, id) <= (?, ?)")) {
          const [at, id, max] = args;
          return rows.filter(r => r.prepared_at < Number(at) ||
            (r.prepared_at === Number(at) && r.id <= String(id))).slice(0, Number(max));
        }
        if (!sql.includes("state='SUBMITTED'")) throw Error("Unexpected SQL: " + sql);
        return rows.slice(0, Number(args[0]));
      },
    }),
  }),
}));
vi.mock("../lib/payments", () => ({
  reconcile: async (id: string) => {
    stub.calls.push(id);
    if (stub.waitOnFirst && stub.calls.length === 1) {
      await new Promise<void>(resolve => { stub.unblock = resolve; });
    }
    if (stub.failIds.includes(id)) throw Error("RPC temporarily unavailable");
  },
}));

let sweep: typeof import("../lib/recovery").reconcilePendingCandidates;
describe("bounded fair background reconciliation", () => {
  beforeEach(async () => {
    stub.calls.length = 0;
    stub.failIds = [];
    stub.waitOnFirst = false;
    stub.unblock = null;
    vi.resetModules(); // New module instance resets private sweep cursor.
    sweep = (await import("../lib/recovery")).reconcilePendingCandidates;
  });

  it("checks at most three persisted candidates per cycle", async () => {
    await sweep(1000);
    expect(stub.calls).toEqual(["req-a", "req-b", "req-c"]);
  });

  it("eventually checks later pending requests behind three unresolved older ones", async () => {
    await sweep();
    await sweep();
    expect(stub.calls).toEqual(["req-a", "req-b", "req-c", "req-d", "req-a", "req-b"]);
    await sweep();
    expect(stub.calls.slice(6)).toEqual(["req-c", "req-d", "req-a"]);
  });

  it("still rotates fairly when old RPC verification calls fail", async () => {
    stub.failIds = ["req-a", "req-b", "req-c"];
    await sweep();
    await sweep();
    expect(stub.calls).toContain("req-d");
    expect(stub.calls).toHaveLength(6);
  });

  it("honors a smaller scan limit without starving later candidates", async () => {
    for (let i=0; i<4; i++) await sweep(1);
    expect(stub.calls).toEqual(["req-a", "req-b", "req-c", "req-d"]);
  });

  it("prevents overlapping sweeps from processing the same request", async () => {
    stub.waitOnFirst = true;
    const first = sweep();
    await Promise.resolve();
    await sweep();
    expect(stub.calls).toEqual(["req-a"]);
    expect(stub.unblock).toBeTypeOf("function");
    stub.unblock!();
    await first;
    expect(stub.calls).toEqual(["req-a", "req-b", "req-c"]);
  });
});
