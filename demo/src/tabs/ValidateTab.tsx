import { useRef, useState } from "react";
import {
  cip100,
  cip108,
  cip119,
  cip136,
  detectCipStandard,
  fetchMetadata,
  resolve,
} from "../lib";
import type {
  CipStandard,
  GovernanceMetadataError,
  ResolvedMetadata,
  Result,
  VerificationResult,
} from "../lib";
import { METADATA_SAMPLES } from "../samples";
import { ResultBadge, type Tone } from "../components/ResultBadge";
import { IssueList } from "../components/IssueList";

const MODULES = {
  "CIP-100": cip100,
  "CIP-108": cip108,
  "CIP-119": cip119,
  "CIP-136": cip136,
} as const;

interface OfflineReport {
  kind: "offline";
  standard: CipStandard | null;
  validate: Result<unknown, GovernanceMetadataError> | null;
  verify: Result<VerificationResult, GovernanceMetadataError> | null;
  parseError?: string;
}

interface OnlineReport {
  kind: "online";
  result: Result<ResolvedMetadata, GovernanceMetadataError>;
}

type Report = OfflineReport | OnlineReport;

export function ValidateTab() {
  const [raw, setRaw] = useState("");
  const [anchorHash, setAnchorHash] = useState("");
  const [uri, setUri] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [fetchNote, setFetchNote] = useState<React.ReactNode>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function loadSample(json: string) {
    setRaw(json);
    setReport(null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRaw(await file.text());
    setReport(null);
  }

  async function runOffline() {
    setBusy(true);
    setReport(null);
    try {
      let doc: Record<string, unknown>;
      try {
        doc = JSON.parse(raw);
      } catch (err) {
        setReport({
          kind: "offline",
          standard: null,
          validate: null,
          verify: null,
          parseError: (err as Error).message,
        });
        return;
      }

      const standard = detectCipStandard(doc);
      const mod = standard ? MODULES[standard] : null;
      const validate = mod ? mod.validate(doc) : null;

      // Anchor hash is defined over the raw serialized bytes — preserve the
      // exact input text rather than re-stringifying the parsed object.
      const rawBytes = new TextEncoder().encode(raw);
      const verify = await (mod ?? cip100).verify(
        { document: doc, rawBytes },
        {
          anchorHash: anchorHash.trim() || undefined,
          contextOptions: { policy: "bundled-only" },
        },
      );

      setReport({ kind: "offline", standard, validate, verify });
    } finally {
      setBusy(false);
    }
  }

  async function fetchRaw() {
    if (!uri.trim()) return;
    setBusy(true);
    setFetchNote(null);
    try {
      // The low-level fetch layer beneath resolve(): returns raw bytes so a
      // caller can hash them for the on-chain anchor before parsing. Here we
      // drop the decoded text into the editor to validate it offline.
      const r = await fetchMetadata(uri.trim());
      if (!r.success) {
        setFetchNote(
          <div className="issue">
            <span className="path">{r.error.code}</span>
            <span className="msg">{r.error.message}</span>
          </div>,
        );
        return;
      }
      const text = new TextDecoder().decode(r.data);
      setRaw(text);
      setReport(null);
      setFetchNote(
        <ResultBadge tone="valid">
          fetched {r.data.length} bytes → loaded into the editor
        </ResultBadge>,
      );
    } finally {
      setBusy(false);
    }
  }

  async function runOnline() {
    if (!uri.trim()) return;
    setBusy(true);
    setReport(null);
    try {
      const result = await resolve(uri.trim(), {
        anchorHash: anchorHash.trim() || undefined,
        contextOptions: { policy: "bundled-only" },
      });
      setReport({ kind: "online", result });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <h2>Validate existing metadata</h2>
          <span className="api-tag">
            detectCipStandard · cipNNN.validate · cipNNN.verify
          </span>
        </div>
        <p className="sub">
          Paste a governance metadata document, upload a file, or load a real
          sample. The document is run through the full consumer pipeline:
          standard detection, schema validation, anchor-hash check, and author
          signature verification (ed25519 &amp; CIP-8 / COSE).
        </p>

        <div className="row" style={{ marginBottom: 14 }}>
          <span className="section-label" style={{ margin: 0 }}>
            Samples
          </span>
          {METADATA_SAMPLES.map((s) => (
            <button
              key={s.id}
              className="btn tiny"
              onClick={() => loadSample(s.json)}
              title={s.note}
            >
              {s.label}
            </button>
          ))}
          <button
            className="btn tiny ghost"
            onClick={() => fileRef.current?.click()}
          >
            Upload file…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.jsonld,application/json"
            style={{ display: "none" }}
            onChange={onFile}
          />
          {raw && (
            <button
              className="btn tiny ghost"
              onClick={() => {
                setRaw("");
                setReport(null);
              }}
            >
              Clear
            </button>
          )}
        </div>

        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={12}
          placeholder='{ "@context": …, "hashAlgorithm": "blake2b-256", "body": { … } }'
        />

        <div className="row" style={{ marginTop: 14 }}>
          <input
            type="text"
            className="mono"
            style={{ flex: 1, minWidth: 240 }}
            placeholder="Optional: expected anchor hash (blake2b-256 hex) for on-chain binding check"
            value={anchorHash}
            onChange={(e) => setAnchorHash(e.target.value)}
          />
          <button
            className="btn primary"
            onClick={runOffline}
            disabled={busy || !raw.trim()}
          >
            {busy ? <span className="spinner" /> : "Validate & Verify"}
          </button>
        </div>

        <div className="divider" />
        <p className="section-label">All-in-one: resolve() from a URI</p>
        <p className="hint" style={{ marginTop: 0 }}>
          Fetches over IPFS / Arweave / HTTPS, then detects, parses, validates
          and verifies in a single call — also surfacing any extra fields.
          Requires network access.
        </p>
        <div className="row" style={{ marginTop: 8 }}>
          <input
            type="text"
            className="mono"
            style={{ flex: 1, minWidth: 240 }}
            placeholder="ipfs://… or https://…"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
          />
          <button
            className="btn ghost"
            onClick={fetchRaw}
            disabled={busy || !uri.trim()}
            title="fetchMetadata() — fetch raw bytes only, then validate offline"
          >
            fetch raw
          </button>
          <button
            className="btn"
            onClick={runOnline}
            disabled={busy || !uri.trim()}
          >
            resolve()
          </button>
        </div>
        {fetchNote && <div style={{ marginTop: 10 }}>{fetchNote}</div>}
      </section>

      {report && (
        <section className="panel">
          <div className="panel-head">
            <h2>Report</h2>
          </div>
          {report.kind === "offline" ? (
            <OfflineView report={report} />
          ) : (
            <OnlineView report={report} />
          )}
        </section>
      )}
    </>
  );
}

function OfflineView({ report }: { report: OfflineReport }) {
  if (report.parseError) {
    return (
      <div className="issue">
        <span className="path">INVALID_JSON</span>
        <span className="msg">{report.parseError}</span>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="readout">
        <div className="readout-row">
          <div className="rk">
            <span className="name">Detected standard</span>
            <span className="meta">detectCipStandard()</span>
          </div>
          {report.standard ? (
            <ResultBadge tone="valid">{report.standard}</ResultBadge>
          ) : (
            <ResultBadge tone="warn">unrecognized</ResultBadge>
          )}
        </div>

        <div className="readout-row">
          <div className="rk">
            <span className="name">Schema validation</span>
            <span className="meta">
              {report.standard
                ? `${report.standard.toLowerCase().replace("-", "")}.validate()`
                : "no schema (standard unknown)"}
            </span>
          </div>
          {report.validate ? (
            report.validate.success ? (
              <ResultBadge tone="valid">valid</ResultBadge>
            ) : (
              <ResultBadge tone="bad">invalid</ResultBadge>
            )
          ) : (
            <ResultBadge tone="neutral">skipped</ResultBadge>
          )}
        </div>
      </div>

      {report.validate && !report.validate.success && (
        <IssueList error={report.validate.error} />
      )}

      {report.verify && (
        <VerificationView verify={report.verify} />
      )}
    </div>
  );
}

function OnlineView({ report }: { report: OnlineReport }) {
  if (!report.result.success) {
    return <IssueList error={report.result.error} />;
  }
  const data = report.result.data;
  return (
    <div className="stack">
      <div className="readout">
        <div className="readout-row">
          <div className="rk">
            <span className="name">Detected standard</span>
            <span className="meta">resolve()</span>
          </div>
          <ResultBadge tone="valid">
            {data.cipStandard}
            {data.extensions.length ? ` + ${data.extensions.join(", ")}` : ""}
          </ResultBadge>
        </div>
        <div className="readout-row">
          <div className="rk">
            <span className="name">Extra fields</span>
            <span className="meta">fields outside the detected standard</span>
          </div>
          {data.extraFields.length ? (
            <ResultBadge tone="warn">{data.extraFields.length}</ResultBadge>
          ) : (
            <ResultBadge tone="valid">none</ResultBadge>
          )}
        </div>
      </div>

      {data.extraFields.length > 0 && (
        <div className="banner warn">
          {data.extraFields.map((f) => (
            <div className="kvline" key={f.path}>
              <span className="k">{f.path}</span>
              <span>{JSON.stringify(f.value).slice(0, 80)}</span>
            </div>
          ))}
        </div>
      )}

      {data.verification && <VerificationView verify={{ success: true, data: data.verification }} />}
      {data.verificationError && (
        <div className="issue">
          <span className="path">{data.verificationError.code}</span>
          <span className="msg">{data.verificationError.message}</span>
        </div>
      )}
    </div>
  );
}

function VerificationView({
  verify,
}: {
  verify: Result<VerificationResult, GovernanceMetadataError>;
}) {
  if (!verify.success) {
    return <IssueList error={verify.error} />;
  }
  const v = verify.data;
  const overall: Tone = v.valid ? "valid" : "bad";

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="section-label" style={{ margin: 0 }}>
          Verification — verify()
        </span>
        <ResultBadge tone={overall}>
          {v.valid ? "all checks passed" : "verification failed"}
        </ResultBadge>
      </div>

      <div className="readout">
        {v.anchorHash && (
          <div className="readout-row">
            <div className="rk">
              <span className="name">Anchor hash</span>
              <span className="meta">
                {v.anchorHash.computed
                  ? `computed ${v.anchorHash.computed.slice(0, 24)}…`
                  : v.anchorHash.reason}
              </span>
            </div>
            <ResultBadge tone={v.anchorHash.valid ? "valid" : "bad"}>
              {v.anchorHash.valid ? "match" : "mismatch"}
            </ResultBadge>
          </div>
        )}

        {v.witnesses.length === 0 ? (
          <div className="readout-row">
            <div className="rk">
              <span className="name">Author witnesses</span>
              <span className="meta">no witnesses present</span>
            </div>
            <ResultBadge tone="neutral">none</ResultBadge>
          </div>
        ) : (
          v.witnesses.map((w) => (
            <div className="readout-row" key={w.authorIndex}>
              <div className="rk">
                <span className="name">
                  {w.authorName ?? `Author #${w.authorIndex}`}{" "}
                  <span className="muted">· {w.witnessAlgorithm}</span>
                </span>
                <span className="meta">key {w.publicKey.slice(0, 32)}…</span>
              </div>
              <ResultBadge tone={w.signatureValid ? "valid" : "bad"}>
                {w.signatureValid
                  ? "signature valid"
                  : w.unsupportedReason ?? "invalid"}
              </ResultBadge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
