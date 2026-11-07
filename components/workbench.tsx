"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useClient } from "@solana/react";
import { useConnect, useConnectedWallet, useDisconnect, useWallets, useWalletStatus } from "@solana/kit-plugin-wallet/react";
import { getBase64Decoder, getBase64Encoder, getTransactionDecoder, getTransactionEncoder } from "@solana/kit";
import { ArrowUpRight, Check, Copy, ImagePlus, RefreshCw, Wallet, ShieldCheck, AlertTriangle, ScanSearch } from "lucide-react";
import type { AppClient } from "@/app/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Recipient = { address: string; lamports: string };
type Model = { modelId: string; weightsId: string; creator: Recipient; provider: Recipient; priceLamports: string; provenance: string };
type Quote = Model & { requestId: string; capability: string; payer: string; inputSha256: string; memo: string; expiresAt: string };
type Prediction = { label: string; score: number };
type Status = {
  requestId: string; state: string; signature: string | null; expiresAt: string;
  result: { predictions: Prediction[]; inferenceMs: number; modelId: string; weightsId: string } | null;
  receipt: { signature: string; slot: number; commitment: string; network: string;
    explorerUrl: string; creatorAddress: string; providerAddress: string;
    creatorLamports: string; providerLamports: string; memo: string } | null;
  errorCode?: string | null;
};
type LocalSession = { requestId: string; capability: string; payer: string; expiresAt: string; quote?: Quote };
const STORAGE_KEY = "alloc:active-request";
const terminal = new Set(["SUCCEEDED", "PAID_FAILED", "EXPIRED"]);
const stateText: Record<string, string> = {
  QUOTED: "Quote ready. Review the exact split before signing.",
  PAYMENT_PENDING: "Checking Devnet payment. Do not pay again.",
  PAID: "Payment verified. Classification queued.",
  RUNNING: "Payment verified. Running the real CPU model.",
  SUCCEEDED: "Inference complete. Settlement and result saved.",
  PAID_FAILED: "Payment verified, but inference failed or its outcome is uncertain. No automatic refund.",
  EXPIRED: "Quote expired. Start a new request only if no payment is pending.",
};
function readError(body: unknown): string {
  const value = body as { error?: { message?: string } };
  return value?.error?.message || "Request failed. Check service status.";
}
function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return <Button variant="ghost" className="copy" aria-label={`Copy ${label}`} onClick={async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); }
  }}>{copied ? <><Check size={16}/> Copied</> : <><Copy size={16}/> Copy</>}</Button>;
}
export default function Workbench() {
  const client = useClient<AppClient>();
  const wallets = useWallets(client);
  const walletStatus = useWalletStatus(client);
  const connected = useConnectedWallet(client);
  const connect = useConnect(client);
  const disconnect = useDisconnect(client);
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [model, setModel] = useState<Model | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [session, setSession] = useState<LocalSession | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const payer = connected?.account.address || "";

  const getStatus = useCallback(async (s: LocalSession) => {
    try {
      const response = await fetch(`/api/v1/requests/${s.requestId}`, {
        headers: { Authorization: `Bearer ${s.capability}` },
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(readError(body));
      setStatus(body as Status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to check payment. Try again later.");
    }
  }, []);

  useEffect(() => {
    fetch("/api/v1/model", { cache: "no-store" })
      .then(async r => { const b = await r.json(); if (!r.ok) throw new Error(readError(b)); setModel(b); })
      .catch(e => setError(e.message));
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const s = JSON.parse(stored) as LocalSession;
        if (s.capability && s.requestId && new Date(s.expiresAt).getTime() + 86400000 > Date.now()) {
          setSession(s);
          if (s.quote?.requestId === s.requestId && s.quote.payer === s.payer) setQuote(s.quote);
          void getStatus(s);
        } else sessionStorage.removeItem(STORAGE_KEY);
      } catch { sessionStorage.removeItem(STORAGE_KEY); }
    }
  }, [getStatus]);

  useEffect(() => {
    if (!session || (status && terminal.has(status.state))) return;
    const timer = setInterval(() => { void getStatus(session); }, 4000);
    return () => clearInterval(timer);
  }, [session, status?.state, getStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function chooseFile(selected: File | null) {
    setError(""); setNotice("");
    if (!selected) return;
    if (!["image/jpeg", "image/png"].includes(selected.type) || selected.size > 5 * 1024 * 1024 || selected.size === 0) {
      setFile(null); setError("Choose a JPEG or PNG smaller than 5 MiB."); return;
    }
    if (session && status && !terminal.has(status.state)) {
      setError("An existing request is unresolved. Check its payment status before replacing the image.");
      return;
    }
    setQuote(null); setFile(selected);
  }

  async function createQuote() {
    if (!file || !payer || working || session && status && !terminal.has(status.state)) return;
    setWorking("Validating image"); setError("");
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("payer", payer);
      const response = await fetch("/api/v1/requests", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(readError(payload));
      const q = payload as Quote;
      setQuote(q);
      const s = { requestId: q.requestId, capability: q.capability, payer: q.payer, expiresAt: q.expiresAt, quote: q };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      setSession(s); setStatus(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Quote failed"); }
    finally { setWorking(""); }
  }

  async function approve() {
    if (!quote || !session || !connected?.signer || quote.payer !== payer || working) return;
    setWorking("Awaiting wallet approval"); setError("");
    let submittedToGateway = false;
    try {
      const response = await fetch(`/api/v1/requests/${quote.requestId}/prepare`, {
        method: "POST", headers: { Authorization: `Bearer ${session.capability}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(readError(body));
      const signer = connected.signer;
      if (!("signTransactions" in signer)) {
        throw new Error("This wallet cannot sign without broadcasting. Choose a wallet supporting signTransaction.");
      }
      const tx = getTransactionDecoder().decode(getBase64Encoder().encode(body.unsignedTransactionBase64));
      // Wallet may modify the transaction; server rechecks byte-for-byte and refuses changes.
      // A wallet partial signer signs the exact compiled message; it does not broadcast.
      // signTransactionWithSigners takes a transaction, not (signers, transaction).
      // Attach only the returned payer signature and keep every message byte unchanged.
      const [signedByWallet] = await signer.signTransactions([tx]);
      const signerSignature = signedByWallet?.[connected.account.address];
      if (!signerSignature) throw new Error("Wallet did not sign the required payer account");
      const signed = { ...tx, signatures: { ...tx.signatures, [connected.account.address]: signerSignature } };
      const signedBase64 = getBase64Decoder().decode(getTransactionEncoder().encode(signed));
      setWorking("Submitting signed payment");
      submittedToGateway = true;
      const paidResponse = await fetch(`/api/v1/requests/${quote.requestId}/payments`, {
        method: "POST", headers: { Authorization: `Bearer ${session.capability}`, "Content-Type": "application/json" },
        body: JSON.stringify({ signedTransaction: signedBase64 }),
      });
      const payload = await paidResponse.json();
      if (!paidResponse.ok) throw new Error(readError(payload));
      setStatus(payload);
      void getStatus(session);
    } catch (e) {
      if (submittedToGateway) {
        // The gateway might have persisted and broadcast after the HTTP response was lost.
        // Never invite a second charge until the same request is reconciled.
        setStatus(previous => previous ?? {
          requestId: session.requestId, state: "PAYMENT_PENDING",
          signature: null, expiresAt: session.expiresAt, result: null, receipt: null,
        });
        void getStatus(session);
        setError("Payment status uncertain. Check this same request before taking any further action.");
      } else {
        setError(e instanceof Error ? e.message : "Wallet approval failed");
      }
    } finally { setWorking(""); }
  }

  function startNew() {
    if (status && !terminal.has(status.state)) {
      setError("Please keep checking the existing payment; opening another purchase could charge again.");
      return;
    }
    sessionStorage.removeItem(STORAGE_KEY);
    setSession(null); setStatus(null); setQuote(null); setFile(null); setNotice(""); setError("");
  }

  const current = status?.state;
  const isPending = !!session && (!status || !terminal.has(status.state));
  const fixed = quote || model;
  const quotedPayerChanged = !!quote && quote.payer !== payer;
  const receipt = status?.receipt;

  return <>
    <header className="header"><div className="header__inner">
      <div className="wordmark">alloc<span style={{ color: "#a1a1aa" }}>.</span></div>
      <div className="flex-gap"><Badge><span className="badge__dot" style={{ color: "#50e3c2" }}/> Solana Devnet · test SOL</Badge></div>
    </div></header>
    <main className="container">
      <div className="hero">
        <div className="eyebrow">VERIFIABLE SPLIT SETTLEMENT / TRUSTED AI COMPUTE</div>
        <h1>One image. Two beneficiaries.<br/>One real inference.</h1>
        <p>Upload a photo, approve one fixed Devnet transaction, and inspect how the payment is split before our private model runs. No tokens, trading, or real-money payments.</p>
      </div>
      {error && <div className="error" role="alert" tabIndex={-1}><AlertTriangle size={16} style={{ display: "inline", marginRight: 8 }}/>{error}</div>}
      {notice && <div className="status-box" role="status">{notice}</div>}
      <div className="grid">
        <div className="stack">
          <Card>
            <div className="card__head"><h2>01 / Image input</h2><Badge>JPEG or PNG · 5 MiB</Badge></div>
            {preview ? <div className="stack" style={{ gap: 12 }}>
              {/* User-selected local preview; image is never made publicly accessible. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Selected image to classify" className="image-preview"/>
              <div className="row"><span className="small muted mono">{file?.name} · {file ? (file.size / 1048576).toFixed(2) : ""} MiB</span>
                <Button variant="secondary" disabled={isPending || !!working} onClick={() => fileInput.current?.click()}>Replace image</Button>
              </div>
            </div> : <div className="drop">
              <ImagePlus size={36} strokeWidth={1.5} color="#a1a1aa"/>
              <p style={{ fontSize: 17, fontWeight: 600 }}>Choose an image to classify</p>
              <p className="muted">JPEG or PNG. Max 16 megapixels after decoding.</p>
              <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={isPending}>Browse files</Button>
            </div>}
            <input ref={fileInput} className="file-input" type="file" accept="image/png,image/jpeg"
              aria-label="Upload image" onChange={e => { chooseFile(e.target.files?.[0] || null); e.target.value = ""; }}/>
            <div className="line"/>
            <div className="meta"><h3>MobileNetV3 Small · ImageNet-1K</h3>
              <p className="muted small">One pretrained CPU image classifier; top-three classes are model outputs, not object counts or calibrated confidence.</p>
              <p className="small muted">Weights: <span className="mono">IMAGENET1K_V1</span> · Upstream model from <a href="https://pytorch.org/vision/stable/models/generated/torchvision.models.mobilenet_v3_small.html" target="_blank" rel="noreferrer">torchvision <ArrowUpRight size={13} style={{display:"inline"}}/></a>.</p>
            </div>
          </Card>

          <Card>
            <div className="card__head"><h2>02 / Payer wallet</h2><Wallet size={19} color="#a1a1aa"/></div>
            {walletStatus === "pending" ? <p className="muted">Discovering compatible wallets…</p> :
              connected ? <>
                <Badge className="badge--success"><span className="badge__dot"/> Wallet connected</Badge>
                <div className="recipient"><div className="small-label">Payer · Devnet</div>
                  <div className="address">{payer}</div><div className="row">
                  <CopyValue value={payer} label="payer address"/>
                  <Button variant="secondary" onClick={() => { void disconnect.dispatchAsync(); setQuote(null); }} disabled={!!working}>Disconnect</Button></div>
                </div>
                <p className="small muted">Your wallet is the only payer and signer. Alloc never receives its private key.</p>
              </> : <>
                <p className="muted">Connect a Solana wallet configured for Devnet. The wallet must support signing a transaction without broadcasting it.</p>
                <div className="wallets">{wallets.length ? wallets.map(w => <Button variant="secondary" key={w.name}
                  disabled={connect.isRunning || !!working} onClick={() => connect.dispatch(w)}>Connect {w.name}</Button>)
                  : <p className="small muted">No compatible browser wallets detected. Install or enable a Solana Wallet Standard wallet.</p>}</div>
                {connect.error && <p className="error" role="alert">{String(connect.error)}</p>}
              </>}
          </Card>
          {status?.result && <Card>
            <div className="card__head"><h2>Classification result</h2><Badge className="badge--success"><span className="badge__dot"/> Real inference</Badge></div>
            <p className="muted small">Model inference: <strong className="mono" style={{ color: "#ededed" }}>{status.result.inferenceMs} ms</strong> · Top 3 ImageNet classes</p>
            {status.result.predictions.map((p, i) => <div className="result-row" key={p.label}>
              <div><div><span className="mono muted small">0{i + 1}</span> <strong>{p.label}</strong></div>
              <div className="scorebar"><span style={{ width: `${p.score * 100}%` }}/></div></div>
              <div className="mono">{(p.score * 100).toFixed(2)}%</div>
            </div>)}
          </Card>}
        </div>

        <div className="stack">
          <Card>
            <div className="card__head"><h2>03 / Settlement quote</h2><Badge><ShieldCheck size={14}/> Fixed split</Badge></div>
            <div className="row"><div><div className="small-label">Per inference · test SOL</div>
              <div className="price mono">0.010000</div></div><Badge>One transaction</Badge></div>
            <div className="allocation" aria-label="70% model beneficiary, 30% compute beneficiary">
              <div className="allocation__creator"/><div className="allocation__provider"/></div>
            <div className="row small"><span>Model beneficiary <strong>70%</strong></span><span className="mono">0.007 SOL</span></div>
            {fixed && <div className="recipient"><div className="small-label">Demo creator address</div><div className="address">{fixed.creator.address}</div>
              <CopyValue value={fixed.creator.address} label="creator address"/></div>}
            <div className="row small" style={{ marginTop: 14 }}><span>Compute operator <strong>30%</strong></span><span className="mono">0.003 SOL</span></div>
            {fixed && <div className="recipient"><div className="small-label">Demo provider address</div><div className="address">{fixed.provider.address}</div>
              <CopyValue value={fixed.provider.address} label="provider address"/></div>}
            <p className="muted small">Wallet network fee is additional. Two native SOL transfers and a public request memo are atomic. Demo recipients are not the upstream model authors.</p>
            <div className="warning"><AlertTriangle size={16} style={{ display: "inline", marginRight: 8 }}/>
              Prepaid trusted compute. Payment can succeed even if inference fails; automatic refunds are not implemented.</div>
            {quote && <div className="status-box">
              <div className="small-label">Immutable request</div><div className="mono small">{quote.requestId}</div>
              <div className="small-label">Input SHA-256</div><div className="mono small">{quote.inputSha256}</div>
              <div className="small-label">Quote expires</div><strong className="mono small">{new Date(quote.expiresAt).toLocaleString()}</strong>
            </div>}
            {!session && <Button className="full" disabled={!file || !payer || !model || !!working}
              onClick={() => void createQuote()}><ScanSearch size={18}/>{working || "Validate & lock quote"}</Button>}
            {quote && !status?.signature && !terminal.has(current || "") && <>
              {quotedPayerChanged && <p className="error">Connected payer has changed. Reconnect the quoted payer to approve.</p>}
              <Button className="full" disabled={!!working || quotedPayerChanged || !connected?.signer}
                onClick={() => void approve()}><Wallet size={18}/>{working || "Approve payment & classify"}</Button>
              <p className="small muted">Review both recipients and the memo in your wallet. If you reject, no payment is broadcast by Alloc.</p>
            </>}
            {session && !quote && !status?.signature && <p className="small muted">Recovered an existing request. Check its status before attempting any new payment.</p>}
            {session && <div className="status-box" aria-live="polite">
              <div className="row"><strong>Request status</strong><Badge className={current === "SUCCEEDED" ? "badge--success" : current === "PAID_FAILED" ? "badge--error" : "badge--warn"}>
                <span className="badge__dot"/>{current || "Checking"}</Badge></div>
              <p className="small muted" style={{ margin: 0 }}>{stateText[current || ""] || "Fetching server state. Do not sign another payment while the outcome is unknown."}</p>
              {status?.signature && <div className="address">Signature: {status.signature}</div>}
              <div className="flex-gap"><Button variant="secondary" disabled={!!working}
                onClick={() => void getStatus(session)}><RefreshCw size={16}/> Check payment</Button>
                {current && terminal.has(current) && <Button variant="secondary" onClick={startNew}>New paid request</Button>}</div>
            </div>}
          </Card>
          {receipt && <Card>
            <div className="card__head"><h2>Verified receipt</h2><Badge className="badge--success"><span className="badge__dot"/> Confirmed</Badge></div>
            <div className="receipt">
              <div><div className="small-label">Network · commitment</div><div className="mono small">Devnet · {receipt.commitment} · slot {receipt.slot}</div></div>
              <div><div className="small-label">Transaction signature</div><div className="address">{receipt.signature}</div>
                <div className="flex-gap"><CopyValue value={receipt.signature} label="transaction signature"/>
                  <a className="button button--secondary" href={receipt.explorerUrl} target="_blank" rel="noopener noreferrer">View in Explorer <ArrowUpRight size={16}/></a></div></div>
              <div><div className="small-label">Public memo</div><div className="address">{receipt.memo}</div></div>
              <div className="line"/>
              <div className="row small"><span>Creator</span><span className="mono">7,000,000 lamports</span></div>
              <div className="address">{receipt.creatorAddress}</div>
              <div className="row small"><span>Provider</span><span className="mono">3,000,000 lamports</span></div>
              <div className="address">{receipt.providerAddress}</div>
            </div>
          </Card>}
        </div>
      </div>
      <footer className="footer">
        Alloc prototype · Solana Devnet only · One MobileNetV3 Small worker · No custody, no escrow, no delivery guarantee.
        <br/>Payment receipt attests to checked settlement; the worker result is trusted off-chain computation.
      </footer>
    </main>
  </>;
}
