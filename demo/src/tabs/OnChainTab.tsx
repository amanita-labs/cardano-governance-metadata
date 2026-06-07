import { useState } from "react";
import { cip169 } from "../lib";
import type {
  GovernanceMetadataError,
  Result,
} from "../lib";
import { toTransactionHex } from "../csl-init";
import {
  METADATA_SAMPLES,
  ONCHAIN_EXAMPLES,
  extractOnChain,
} from "../samples";
import { ResultBadge } from "../components/ResultBadge";
import { IssueList } from "../components/IssueList";

type Mode = "compare" | "tx";

export function OnChainTab() {
  const [mode, setMode] = useState<Mode>("compare");
  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <h2>CIP-169 · On-chain effects</h2>
          <span className="api-tag">
            compareOnChain · decodeConwayTx · verifyAgainstTx
          </span>
        </div>
        <p className="sub">
          CIP-169 binds a metadata document to the exact on-chain governance
          action it describes. Compare two on-chain payloads structurally, or
          verify a document against a real Conway transaction (decoded in-browser
          via the Cardano Serialization Library).
        </p>
        <div className="pill-group">
          <button aria-pressed={mode === "compare"} onClick={() => setMode("compare")}>
            Compare payloads
          </button>
          <button aria-pressed={mode === "tx"} onClick={() => setMode("tx")}>
            Verify against tx
          </button>
        </div>
      </section>

      {mode === "compare" ? <CompareView /> : <TxView />}
    </>
  );
}

function CompareView() {
  const seed = extractOnChain(ONCHAIN_EXAMPLES[0].json);
  const [a, setA] = useState(seed);
  const [b, setB] = useState(seed);
  const [result, setResult] = useState<
    Result<cip169Compare, GovernanceMetadataError> | { parseError: string } | null
  >(null);

  type cip169Compare = { equal: boolean; differences: { path: string; metadataValue: unknown; actionValue: unknown }[] };

  function run() {
    let pa: unknown;
    let pb: unknown;
    try {
      pa = JSON.parse(a);
      pb = JSON.parse(b);
    } catch (e) {
      setResult({ parseError: (e as Error).message });
      return;
    }
    setResult(cip169.compareOnChain(pa, pb) as Result<cip169Compare, GovernanceMetadataError>);
  }

  return (
    <section className="panel">
      <div className="row" style={{ marginBottom: 12, justifyContent: "space-between" }}>
        <span className="section-label" style={{ margin: 0 }}>
          compareOnChain(a, b)
        </span>
        <div className="row">
          {ONCHAIN_EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              className="btn tiny"
              onClick={() => {
                const v = extractOnChain(ex.json);
                setA(v);
                setB(v);
                setResult(null);
              }}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cols">
        <label className="field">
          <span className="field-label">A — metadata.onChain</span>
          <textarea className="mono" rows={14} value={a} onChange={(e) => setA(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">B — on-chain action (edit me to see a diff)</span>
          <textarea className="mono" rows={14} value={b} onChange={(e) => setB(e.target.value)} />
        </label>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn primary" onClick={run}>Compare</button>
      </div>

      {result && (
        <div style={{ marginTop: 18 }}>
          {"parseError" in result ? (
            <div className="issue">
              <span className="path">INVALID_JSON</span>
              <span className="msg">{result.parseError}</span>
            </div>
          ) : !result.success ? (
            <IssueList error={result.error} />
          ) : result.data.equal ? (
            <ResultBadge tone="valid">equal — payloads match</ResultBadge>
          ) : (
            <>
              <ResultBadge tone="bad">
                {result.data.differences.length} difference
                {result.data.differences.length === 1 ? "" : "s"}
              </ResultBadge>
              <table className="diff" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>path</th>
                    <th>A (metadata)</th>
                    <th>B (action)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.differences.map((d, i) => (
                    <tr key={i}>
                      <td className="path">{d.path}</td>
                      <td className="a">{JSON.stringify(d.metadataValue)}</td>
                      <td className="b">{JSON.stringify(d.actionValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// Default to the info-action sample — it matches cleanly. (The treasury
// withdrawals carry an on-chain guardrails `policy_hash` the metadata omits, so
// they legitimately report a mismatch — a useful real-world example.)
const TX_SAMPLE =
  METADATA_SAMPLES.find((s) => s.id === "info" && s.txCborHex) ??
  METADATA_SAMPLES.find((s) => s.txCborHex) ??
  METADATA_SAMPLES[0];

type SelectorKind = "auto" | "proposalProcedure" | "certificate" | "votingProcedures";

function TxView() {
  const [meta, setMeta] = useState(TX_SAMPLE.json);
  const [cbor, setCbor] = useState(TX_SAMPLE.txCborHex ?? "");
  const [selKind, setSelKind] = useState<SelectorKind>("auto");
  const [selIndex, setSelIndex] = useState("0");
  const [busy, setBusy] = useState(false);
  const [decoded, setDecoded] = useState<string | null>(null);
  const [verifyOut, setVerifyOut] = useState<React.ReactNode>(null);

  async function run() {
    setBusy(true);
    setDecoded(null);
    setVerifyOut(null);
    try {
      // Loads CSL (WASM) and wraps a bare VotingProposal into a full Conway tx
      // if needed — the library decodes transactions, not bare proposals.
      let txHex: string;
      try {
        txHex = await toTransactionHex(cbor);
      } catch (e) {
        setVerifyOut(
          <div className="issue">
            <span className="path">CBOR</span>
            <span className="msg">
              Could not read this as a transaction or proposal: {(e as Error).message}
            </span>
          </div>,
        );
        return;
      }

      // Decode the Conway tx for a structural readout.
      const dec = cip169.decodeConwayTx(txHex);
      if (dec.success) {
        const d = dec.data;
        setDecoded(
          `proposals: ${d.proposalProcedures.length}   certificates: ${d.certificates.length}   votes: ${
            d.votingProcedures ? Object.keys(d.votingProcedures).length : 0
          }${d.skipped.length ? `\nskipped: ${d.skipped.map((s) => `${s.kind} (${s.reason})`).join(", ")}` : ""}`,
        );
      } else {
        setDecoded(`decode failed: ${dec.error.code} — ${dec.error.message}`);
      }

      let metadata: unknown;
      try {
        metadata = JSON.parse(meta);
      } catch (e) {
        setVerifyOut(
          <div className="issue">
            <span className="path">INVALID_JSON</span>
            <span className="msg">{(e as Error).message}</span>
          </div>,
        );
        return;
      }

      const selector =
        selKind === "auto"
          ? undefined
          : selKind === "votingProcedures"
            ? { kind: "votingProcedures" as const }
            : { kind: selKind, index: Number(selIndex) };

      const res = await cip169.verifyAgainstTx(metadata, txHex, {
        selector: selector as never,
      });

      if (!res.success) {
        setVerifyOut(<IssueList error={res.error} />);
      } else if (res.data.matched) {
        setVerifyOut(
          <div className="stack">
            <ResultBadge tone="valid">
              matched — metadata is bound to this transaction
            </ResultBadge>
            <div className="kvline">
              <span className="k">selectorUsed</span>
              <span>{JSON.stringify(res.data.selectorUsed)}</span>
            </div>
          </div>,
        );
      } else {
        setVerifyOut(
          <div className="stack">
            <ResultBadge tone="bad">
              mismatch — {res.data.differences.length} difference
              {res.data.differences.length === 1 ? "" : "s"}
            </ResultBadge>
            <table className="diff">
              <thead>
                <tr>
                  <th>path</th>
                  <th>metadata</th>
                  <th>on-chain</th>
                </tr>
              </thead>
              <tbody>
                {res.data.differences.map((d, i) => (
                  <tr key={i}>
                    <td className="path">{d.path}</td>
                    <td className="a">{JSON.stringify(d.metadataValue)}</td>
                    <td className="b">{JSON.stringify(d.actionValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="banner info">
        First run lazily loads the Cardano Serialization Library (WASM, a few MB)
        to decode the transaction. The samples ship a bare on-chain proposal,
        which is wrapped in a minimal Conway tx automatically. The{" "}
        <strong>{TX_SAMPLE.label}</strong> sample matches cleanly; the treasury
        withdrawals legitimately differ on <code>gov_action.policy_hash</code>
        {" "}(the on-chain action carries a guardrails script the metadata
        omits) — a real-world mismatch worth seeing.
      </div>

      <div className="row" style={{ marginBottom: 10 }}>
        <span className="section-label" style={{ margin: 0 }}>Samples</span>
        {METADATA_SAMPLES.filter((s) => s.txCborHex).map((s) => (
          <button
            key={s.id}
            className="btn tiny"
            onClick={() => {
              setMeta(s.json);
              setCbor(s.txCborHex ?? "");
              setDecoded(null);
              setVerifyOut(null);
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="cols">
        <label className="field">
          <span className="field-label">metadata document (with body.onChain)</span>
          <textarea className="mono" rows={14} value={meta} onChange={(e) => setMeta(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Conway transaction CBOR (hex)</span>
          <textarea className="mono" rows={14} value={cbor} onChange={(e) => setCbor(e.target.value)} />
        </label>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <label className="field" style={{ minWidth: 200 }}>
          <span className="field-label">selector</span>
          <select value={selKind} onChange={(e) => setSelKind(e.target.value as SelectorKind)}>
            <option value="auto">auto (single item)</option>
            <option value="proposalProcedure">proposalProcedure</option>
            <option value="certificate">certificate</option>
            <option value="votingProcedures">votingProcedures</option>
          </select>
        </label>
        {(selKind === "proposalProcedure" || selKind === "certificate") && (
          <label className="field" style={{ width: 110 }}>
            <span className="field-label">index</span>
            <input type="number" value={selIndex} onChange={(e) => setSelIndex(e.target.value)} />
          </label>
        )}
        <button className="btn primary" onClick={run} disabled={busy || !cbor.trim()} style={{ alignSelf: "flex-end" }}>
          {busy ? <span className="spinner" /> : "Decode & Verify"}
        </button>
      </div>

      {decoded && (
        <div style={{ marginTop: 16 }}>
          <p className="section-label">decodeConwayTx()</p>
          <pre className="mono-chip" style={{ whiteSpace: "pre-wrap", display: "block", padding: 12 }}>
            {decoded}
          </pre>
        </div>
      )}
      {verifyOut && (
        <div style={{ marginTop: 16 }}>
          <p className="section-label">verifyAgainstTx()</p>
          {verifyOut}
        </div>
      )}
    </section>
  );
}
