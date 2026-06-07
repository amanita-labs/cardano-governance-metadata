import { useState } from "react";
import {
  decodeCoseSign1,
  verifyCip8Witness,
  listBundledContextUrls,
  registerContext,
  unregisterContext,
  clearRegisteredContexts,
  createDocumentLoader,
} from "../lib";
import { ResultBadge } from "../components/ResultBadge";

// Small local hex encoder — used only to display the raw bytes the library's
// COSE decoder returns. Not a library API.
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// A real CIP-8 / COSE_Sign1 witness signature (from the EMURGO sample) and the
// ed25519 public key that signed it — so the verify default lands green.
const SAMPLE_COSE =
  "84582aa201276761646472657373581de1807b90d9b566cfa95e749836edf77bdf09207dc0825561fefbdc3a69a166686173686564f458201966d1f40b8cd6e730ead2312efc66b57d72617e5cc686132bd480f5e13636a9584044aaf5048021a90216a5038db6066021cb1b0ed8e2472f832a8b7d27deded19df6f620a08e1a82a9b1522857976cf74c79d83d41e9ddfc881f34c24781eeb903";
const SAMPLE_PUBKEY =
  "0c7148d760478182ec0722c78483b4c057fa35425b1ef579f6a5ce4e40e3d591";

export function ToolboxTab() {
  return (
    <>
      <CoseInspector />
      <ContextInspector />
    </>
  );
}

function CoseInspector() {
  const [hex, setHex] = useState(SAMPLE_COSE);
  const [pubKey, setPubKey] = useState(SAMPLE_PUBKEY);
  const [out, setOut] = useState<React.ReactNode>(null);
  const [verifyOut, setVerifyOut] = useState<React.ReactNode>(null);

  function decode() {
    setVerifyOut(null);
    const r = decodeCoseSign1(hex.trim());
    if (!r.ok) {
      setOut(
        <div className="issue">
          <span className="path">decode</span>
          <span className="msg">{r.reason}</span>
        </div>,
      );
      return;
    }
    const c = r.cose;
    setOut(
      <div className="readout">
        <Kv k="protected header" v={`${toHex(c.protectedBstr)} (${c.protectedBstr.length} bytes)`} />
        <Kv k="payload" v={`${toHex(c.payload)} (${c.payload.length} bytes)`} />
        <Kv k="signature" v={`${toHex(c.signature)} (${c.signature.length} bytes)`} />
      </div>,
    );
  }

  async function verify() {
    setVerifyOut(null);
    const decoded = decodeCoseSign1(hex.trim());
    if (!decoded.ok) {
      setVerifyOut(
        <div className="issue">
          <span className="path">decode</span>
          <span className="msg">{decoded.reason}</span>
        </div>,
      );
      return;
    }
    // The witness binds its payload (the canonical body hash) — verify the inner
    // ed25519 signature against the supplied public key, using the envelope's
    // own payload as the expected bytes.
    const r = await verifyCip8Witness(
      hex.trim(),
      decoded.cose.payload,
      pubKey.trim(),
    );
    setVerifyOut(
      r.valid ? (
        <ResultBadge tone="valid">signature valid — ed25519 over COSE Sig_structure</ResultBadge>
      ) : (
        <div className="issue">
          <span className="path">invalid</span>
          <span className="msg">{r.reason ?? "signature does not verify"}</span>
        </div>
      ),
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>COSE_Sign1 inspector</h2>
        <span className="api-tag">decodeCoseSign1 · verifyCip8Witness</span>
      </div>
      <p className="sub">
        CIP-8 / CIP-0008 author witnesses carry a full COSE_Sign1 envelope as
        their <code>signature</code>. Decode one to inspect its protected header,
        payload, and inner ed25519 signature — then verify it against a public
        key, exactly as <code>verify()</code> does for CIP-8 witnesses.
      </p>
      <label className="field">
        <span className="field-label">COSE_Sign1 (hex)</span>
        <textarea className="mono" rows={5} value={hex} onChange={(e) => setHex(e.target.value)} />
      </label>
      <label className="field" style={{ marginTop: 12 }}>
        <span className="field-label">signer public key (ed25519, hex)</span>
        <input type="text" className="mono" value={pubKey} onChange={(e) => setPubKey(e.target.value)} />
      </label>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={decode} disabled={!hex.trim()}>
          Decode
        </button>
        <button className="btn" onClick={verify} disabled={!hex.trim() || !pubKey.trim()}>
          verifyCip8Witness()
        </button>
      </div>
      {out && <div style={{ marginTop: 16 }}>{out}</div>}
      {verifyOut && <div style={{ marginTop: 14 }}>{verifyOut}</div>}
    </section>
  );
}

function ContextInspector() {
  const [bundled, setBundled] = useState<string[] | null>(null);
  const [url, setUrl] = useState("https://example.com/my.jsonld");
  const [doc, setDoc] = useState('{\n  "@context": { "name": "http://schema.org/name" }\n}');
  const [status, setStatus] = useState<React.ReactNode>(null);

  // createDocumentLoader demo
  const [loaderUrl, setLoaderUrl] = useState(
    "https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0108/cip-0108.common.jsonld",
  );
  const [loaderOut, setLoaderOut] = useState<React.ReactNode>(null);

  function list() {
    setBundled(listBundledContextUrls());
  }

  function register() {
    try {
      registerContext(url.trim(), JSON.parse(doc));
      setStatus(<ResultBadge tone="valid">registered — now resolvable offline</ResultBadge>);
      setBundled(listBundledContextUrls());
    } catch (e) {
      setStatus(
        <div className="issue">
          <span className="path">register</span>
          <span className="msg">{(e as Error).message}</span>
        </div>,
      );
    }
  }

  function unregister(u: string) {
    const removed = unregisterContext(u);
    setStatus(
      <ResultBadge tone={removed ? "valid" : "neutral"}>
        {removed ? `unregistered ${u.slice(0, 48)}…` : "was not registered (bundled contexts can't be removed)"}
      </ResultBadge>,
    );
    setBundled(listBundledContextUrls());
  }

  function clearAll() {
    clearRegisteredContexts();
    setStatus(<ResultBadge tone="neutral">runtime registrations cleared</ResultBadge>);
    setBundled(listBundledContextUrls());
  }

  async function resolveThroughLoader() {
    setLoaderOut(null);
    // Strictest policy: only bundled / registered contexts resolve; anything
    // else throws MISSING_CONTEXT instead of hitting the network.
    const loader = createDocumentLoader({ policy: "bundled-only" });
    try {
      const remote = await loader(loaderUrl.trim());
      const ctx = (remote.document as { "@context"?: unknown })?.["@context"];
      const keys =
        ctx && typeof ctx === "object" ? Object.keys(ctx as object) : [];
      setLoaderOut(
        <div className="stack">
          <ResultBadge tone="valid">resolved offline</ResultBadge>
          <div className="kvline">
            <span className="k">documentUrl</span>
            <span className="mono-chip" style={{ border: "none", background: "none", padding: 0 }}>
              {remote.documentUrl}
            </span>
          </div>
          <div className="kvline">
            <span className="k">@context keys</span>
            <span>{keys.length ? keys.join(", ") : "(document has no top-level @context object)"}</span>
          </div>
        </div>,
      );
    } catch (e) {
      setLoaderOut(
        <div className="issue">
          <span className="path">{(e as { code?: string }).code ?? "MISSING_CONTEXT"}</span>
          <span className="msg">{(e as Error).message}</span>
        </div>,
      );
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>JSON-LD context resolution</h2>
        <span className="api-tag">
          listBundledContextUrls · registerContext · unregisterContext · createDocumentLoader
        </span>
      </div>
      <p className="sub">
        Canonicalization (and therefore signature verification) resolves the
        document&apos;s <code>@context</code>. The library bundles the CIP
        contexts so it works offline; you can also register your own at runtime.
      </p>

      <div className="row">
        <button className="btn" onClick={list}>List resolvable contexts</button>
        <button className="btn ghost" onClick={clearAll}>Clear registered</button>
      </div>

      {bundled && (
        <div className="readout" style={{ marginTop: 14 }}>
          {bundled.length === 0 ? (
            <div className="readout-row"><span className="muted">none</span></div>
          ) : (
            bundled.map((u) => (
              <div className="readout-row" key={u}>
                <span className="mono-chip" style={{ border: "none", background: "none", padding: 0 }}>{u}</span>
                <button
                  className="btn tiny ghost"
                  onClick={() => unregister(u)}
                  title="unregisterContext() — only removes runtime registrations"
                >
                  unregister
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div className="divider" />
      <p className="section-label">Register a custom context</p>
      <div className="cols">
        <label className="field">
          <span className="field-label">context URL</span>
          <input type="text" className="mono" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">context document (JSON)</span>
          <textarea className="mono" rows={5} value={doc} onChange={(e) => setDoc(e.target.value)} />
        </label>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={register}>registerContext()</button>
      </div>
      {status && <div style={{ marginTop: 14 }}>{status}</div>}

      <div className="divider" />
      <p className="section-label">Resolve a context through a document loader</p>
      <p className="hint" style={{ marginTop: 0 }}>
        <code>createDocumentLoader(&#123; policy: "bundled-only" &#125;)</code> returns the
        function JSON-LD uses to fetch <code>@context</code> URLs. With{" "}
        <code>bundled-only</code>, a bundled URL resolves offline and anything
        else throws <code>MISSING_CONTEXT</code> — try editing the URL.
      </p>
      <div className="row">
        <input
          type="text"
          className="mono"
          style={{ flex: 1, minWidth: 240 }}
          value={loaderUrl}
          onChange={(e) => setLoaderUrl(e.target.value)}
        />
        <button className="btn primary" onClick={resolveThroughLoader} disabled={!loaderUrl.trim()}>
          resolve()
        </button>
      </div>
      {loaderOut && <div style={{ marginTop: 14 }}>{loaderOut}</div>}
    </section>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="readout-row">
      <div className="rk">
        <span className="name">{k}</span>
      </div>
      <span className="mono-chip" style={{ maxWidth: "62%" }}>{v}</span>
    </div>
  );
}
