import { describe, expect, it } from "vitest";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { db, getRequest, requireRequest, transact } from "../lib/db";

const tmp = mkdtempSync(join(tmpdir(), "alloc-db-test-"));
process.env.DATABASE_PATH = join(tmp,"ledger.sqlite");
const database = db();
const id = randomUUID();
const capability = randomBytes(32).toString("base64url");
const now = Date.now();
database.prepare(`INSERT INTO requests(id,capability_hash,payer,input_sha256,upload_path,model_id,weights_id,created_at,expires_at,created_slot,state,creator,provider)
VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, createHash("sha256").update(capability).digest("hex"),
  "PAYER", "aa".repeat(32), "/tmp/image", "mobilenet-v3-small","IMAGENET1K_V1", now, now+900000,1,"QUOTED","CREATOR","PROVIDER");
const attempt = randomUUID();
database.prepare(`INSERT INTO payment_attempts(id,request_id,unsigned_base64,message_sha256,blockhash,last_valid_block_height,prepared_at,state,signature,signed_base64)
VALUES(?,?,?,?,?,?,?,?,?,?)`).run(attempt,id,"abc", "bb".repeat(32),"abc",20,now,"SUBMITTED","signature-that-is-unique","abc");

describe("durable ledger", () => {
  it("stores only a capability hash and enforces capability", () => {
    expect(getRequest(id)?.capability_hash).not.toContain(capability);
    expect(() => requireRequest(id, null)).toThrow();
    expect(() => requireRequest(id, "Bearer bad")).toThrow();
    expect(requireRequest(id, "Bearer "+capability).id).toBe(id);
  });
  it("denies signature reuse across requests", () => {
    const other = randomUUID();
    database.prepare(`INSERT INTO requests(id,capability_hash,payer,input_sha256,upload_path,model_id,weights_id,created_at,expires_at,created_slot,state,creator,provider) SELECT ?,capability_hash,payer,input_sha256,upload_path,model_id,weights_id,created_at,expires_at,created_slot,state,creator,provider FROM requests WHERE id=?`).run(other,id);
    expect(() => database.prepare(`INSERT INTO payment_attempts(id,request_id,unsigned_base64,message_sha256,blockhash,last_valid_block_height,prepared_at,state,signature)
      VALUES(?,?,?,?,?,?,?,'SUBMITTED',?)`).run(randomUUID(),other,"abc","xx","block",42,now,"signature-that-is-unique")).toThrow();
  });
  it("only one verified claim can ever exist for a request", () => {
    const successes = Array.from({length:10}, (_,i) => {
      try {
        transact(() => {
          database.prepare(`INSERT INTO fulfillments(request_id,attempt_id,execution_id,state) VALUES(?,?,?,'PAID')`)
            .run(id, attempt, "exec"+i);
        });
        return true;
      } catch { return false; }
    });
    expect(successes.filter(Boolean)).toHaveLength(1);
    expect((database.prepare("SELECT COUNT(*) n FROM fulfillments WHERE request_id=?").get(id) as {n:number}).n).toBe(1);
  });
  it("a second DB connection after restart sees the same signature and result", () => {
    database.prepare("UPDATE fulfillments SET state='SUCCEEDED',result_json=? WHERE request_id=?")
      .run(JSON.stringify({predictions:[{label:"test",score:0.1}]}),id);
    const other = new Database(process.env.DATABASE_PATH);
    try {
      expect((other.prepare("SELECT COUNT(*) n FROM payment_attempts WHERE signature=?").get("signature-that-is-unique") as {n:number}).n).toBe(1);
      expect((other.prepare("SELECT state FROM fulfillments WHERE request_id=?").get(id) as {state:string}).state).toBe("SUCCEEDED");
      expect(() => other.prepare("INSERT INTO fulfillments(request_id,attempt_id,execution_id,state) VALUES(?,?,?,?)").run(id,attempt,"new","PAID")).toThrow();
    } finally { other.close(); }
  });
});

describe("inter-process payment claim races", () => {
  it("allows only one of ten independent Node processes to claim one payment", async () => {
    const raceId = randomUUID(), raceAttempt = randomUUID();
    database.prepare(`INSERT INTO requests(id,capability_hash,payer,input_sha256,upload_path,model_id,weights_id,created_at,expires_at,created_slot,state,creator,provider)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(raceId, createHash("sha256").update(capability).digest("hex"),
      "PAYER", "bb".repeat(32), "/tmp/race-image", "mobilenet-v3-small", "IMAGENET1K_V1",
      now, now+900000, 1, "PAYMENT_PENDING", "CREATOR", "PROVIDER");
    database.prepare(`INSERT INTO payment_attempts(id,request_id,unsigned_base64,message_sha256,blockhash,last_valid_block_height,prepared_at,state,signature)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(raceAttempt,raceId,"abc","bb".repeat(32),"hash",300,now,"VERIFIED",randomUUID());

    // Each process has its own SQLite connection and attempts BEGIN IMMEDIATE
    // independently; unlike an in-process Promise.all this is a real DB lock race.
    const code = `
      const D=require("better-sqlite3");
      const db=new D(process.argv[1]);
      db.pragma("busy_timeout = 5000");
      const tx=db.transaction(() => db.prepare(
        "INSERT INTO fulfillments(request_id,attempt_id,execution_id,state) VALUES(?,?,?,\'PAID\')"
      ).run(process.argv[2],process.argv[3],process.argv[4]));
      try { tx.immediate(); process.exit(0); }
      catch { process.exit(3); }
    `;
    const exits = await Promise.all(Array.from({ length: 10 }, (_, i) => new Promise<number>((resolve, reject) => {
      const child = spawn(process.execPath, ["-e", code, process.env.DATABASE_PATH!, raceId, raceAttempt, "exec-"+i], {stdio: "ignore"});
      child.once("error", reject);
      child.once("close", code => resolve(code ?? -1));
    })));
    expect(exits.filter(code => code === 0)).toHaveLength(1);
    expect(exits.filter(code => code === 3)).toHaveLength(9);
    expect((database.prepare("SELECT COUNT(*) n FROM fulfillments WHERE request_id=?").get(raceId) as { n: number }).n).toBe(1);
  }, 20_000);
});
