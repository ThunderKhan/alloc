import Database from "better-sqlite3";
import { createHash, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { RequestState } from "./constants";
import { ApiError } from "./errors";

export type RequestRow = {
  id: string; capability_hash: string; payer: string; input_sha256: string;
  upload_path: string; model_id: string; weights_id: string;
  created_at: number; expires_at: number; created_slot: number; state: RequestState;
  creator: string; provider: string;
  price_lamports: number; creator_lamports: number; provider_lamports: number;
};
export type AttemptRow = {
  id: string; request_id: string; unsigned_base64: string; message_sha256: string;
  blockhash: string; last_valid_block_height: number; prepared_at: number;
  state: "PREPARED" | "SUBMITTED" | "VERIFIED" | "FAILED" | "EXPIRED";
  signature: string | null; signed_base64: string | null; verified_slot: number | null;
};
export type FulfillmentRow = {
  request_id: string; attempt_id: string; execution_id: string;
  state: "PAID" | "RUNNING" | "SUCCEEDED" | "PAID_FAILED";
  started_at: number | null; finished_at: number | null;
  result_json: string | null; error_code: string | null;
};

let singleton: Database.Database | null = null;

export function db(): Database.Database {
  if (singleton) return singleton;
  const path = process.env.DATABASE_PATH || "./data/alloc.sqlite";
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const database = new Database(path);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  database.exec(`
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY, capability_hash TEXT NOT NULL,
      payer TEXT NOT NULL, input_sha256 TEXT NOT NULL,
      upload_path TEXT NOT NULL, model_id TEXT NOT NULL, weights_id TEXT NOT NULL,
      created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, created_slot INTEGER NOT NULL,
      state TEXT NOT NULL, creator TEXT NOT NULL, provider TEXT NOT NULL,
      price_lamports INTEGER NOT NULL DEFAULT 10000000,
      creator_lamports INTEGER NOT NULL DEFAULT 7000000,
      provider_lamports INTEGER NOT NULL DEFAULT 3000000
    );
    CREATE TABLE IF NOT EXISTS payment_attempts (
      id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES requests(id),
      unsigned_base64 TEXT NOT NULL, message_sha256 TEXT NOT NULL,
      blockhash TEXT NOT NULL, last_valid_block_height INTEGER NOT NULL,
      prepared_at INTEGER NOT NULL, signature TEXT UNIQUE, signed_base64 TEXT,
      state TEXT NOT NULL, verified_slot INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_live_attempt ON payment_attempts(request_id)
      WHERE state IN ('PREPARED','SUBMITTED','VERIFIED');
    CREATE TABLE IF NOT EXISTS fulfillments (
      request_id TEXT PRIMARY KEY REFERENCES requests(id),
      attempt_id TEXT NOT NULL UNIQUE REFERENCES payment_attempts(id),
      execution_id TEXT NOT NULL UNIQUE, state TEXT NOT NULL,
      started_at INTEGER, finished_at INTEGER, result_json TEXT, error_code TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT NOT NULL,
      at_ms INTEGER NOT NULL, event TEXT NOT NULL
    );
  `);
  // Migrate earlier feature-branch database files without dropping requests or payments.
  const existingColumns = new Set(
    (database.pragma("table_info(requests)") as Array<{ name: string }>).map(col => col.name)
  );
  for (const [column, amount] of [
    ["price_lamports", 10000000],
    ["creator_lamports", 7000000],
    ["provider_lamports", 3000000],
  ] as const) {
    if (!existingColumns.has(column)) {
      database.exec(`ALTER TABLE requests ADD COLUMN ${column} INTEGER NOT NULL DEFAULT ${amount}`);
    }
  }
  // An uncertain computation may have completed before the crash; never auto-run it.
  database.prepare("UPDATE fulfillments SET state='PAID_FAILED', finished_at=?, error_code='INTERRUPTED' WHERE state='RUNNING'")
    .run(Date.now());
  database.prepare("UPDATE requests SET state='PAID_FAILED' WHERE state='RUNNING'").run();
  singleton = database;
  return database;
}

export function getRequest(id: string): RequestRow | undefined {
  return db().prepare("SELECT * FROM requests WHERE id=?").get(id) as RequestRow | undefined;
}
export function getAttempt(id: string): AttemptRow | undefined {
  return db().prepare("SELECT * FROM payment_attempts WHERE request_id=? ORDER BY rowid DESC LIMIT 1")
    .get(id) as AttemptRow | undefined;
}
export function getFulfillment(id: string): FulfillmentRow | undefined {
  return db().prepare("SELECT * FROM fulfillments WHERE request_id=?").get(id) as FulfillmentRow | undefined;
}
export function requireRequest(id: string, auth: string | null): RequestRow {
  const row = getRequest(id);
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
  const received = createHash("sha256").update(token).digest();
  const saved = row?.capability_hash ? Buffer.from(row.capability_hash, "hex") : Buffer.alloc(32);
  if (received.length !== saved.length || !timingSafeEqual(received, saved) || !row) {
    throw new ApiError(401, "INVALID_CAPABILITY", "Invalid or missing request capability");
  }
  if (row.created_at + 24 * 60 * 60 * 1000 < Date.now()) {
    throw new ApiError(410, "QUOTE_EXPIRED", "Request access expired");
  }
  return row;
}
export function transact<T>(fn: () => T): T {
  return db().transaction(fn).immediate();
}
export function audit(id: string, event: string) {
  db().prepare("INSERT INTO audit_events(request_id,at_ms,event) VALUES(?,?,?)").run(id, Date.now(), event);
}
