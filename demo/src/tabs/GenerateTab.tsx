import { useMemo, useState } from "react";
import { cip100, cip108, cip119, cip136, cip169, createDocumentLoader } from "../lib";
import type {
  Cip169Credential,
  GovAction,
  GovernanceMetadataError,
  HashedReference,
  OnChain,
  Result,
} from "../lib";
import { parseProposalMarkdown, type ParsedReference } from "../markdown";
import { Field } from "../components/Field";
import { JsonView } from "../components/JsonView";
import { IssueList } from "../components/IssueList";
import { ResultBadge } from "../components/ResultBadge";

type Std = "CIP-100" | "CIP-108" | "CIP-119" | "CIP-136";

const STD_INFO: Record<Std, string> = {
  "CIP-100": "Base envelope — author witnesses + free-form comment.",
  "CIP-108": "Governance action proposal (title, abstract, motivation, rationale).",
  "CIP-119": "DRep registration (given name, objectives, motivations…).",
  "CIP-136": "Constitutional Committee vote (summary, rationale, tally).",
};

// Every CIP-169 effect, grouped by the on-chain shape it produces. Proposal
// actions nest under { deposit, reward_account, gov_action }; certificates and
// voting procedures ARE the OnChain payload directly.
type EffectKind =
  | "none"
  | "info_action"
  | "parameter_change_action"
  | "hard_fork_initiation_action"
  | "treasury_withdrawals_action"
  | "no_confidence"
  | "update_committee"
  | "new_constitution"
  | "register_drep"
  | "update_drep"
  | "resign_committee_cold"
  | "voting_procedures";

const PROPOSAL_ACTIONS: EffectKind[] = [
  "info_action",
  "parameter_change_action",
  "hard_fork_initiation_action",
  "treasury_withdrawals_action",
  "no_confidence",
  "update_committee",
  "new_constitution",
];

// ── @context sources ─────────────────────────────────────────────────────
// The library injects these canonical CIP URLs by default (mirrors
// src/core/default-contexts.ts); they're also the URLs it resolves offline.
const LIBRARY_CONTEXT_URL: Record<Std, string> = {
  "CIP-100": "https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0100/cip-0100.common.jsonld",
  "CIP-108": "https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0108/cip-0108.common.jsonld",
  "CIP-119": "https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0119/cip-0119.common.jsonld",
  "CIP-136": "https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0136/cip-0136.common.jsonld",
};

// Intersect-hosted governance-action schemas — the exact URLs IntersectMBO's
// metadata-create.sh selects per action type.
const INTERSECT_BASE = "https://intersectmbo.github.io/governance-actions/v1.0.0/schemas";
const INTERSECT_PATH: Partial<Record<EffectKind, string>> = {
  info_action: "info",
  treasury_withdrawals_action: "treasury-withdrawals",
  parameter_change_action: "parameter-changes",
  hard_fork_initiation_action: "hard-fork-initiation",
  update_committee: "update-committee",
};
function intersectUrlFor(effect: EffectKind): string {
  const path = INTERSECT_PATH[effect] ?? "info";
  return `${INTERSECT_BASE}/${path}/common.jsonld`;
}

type CtxMode = "url" | "inline";
type CtxSource = "library" | "intersect" | "custom";

function jsonError(e: unknown, field: string): GovernanceMetadataError {
  return {
    code: "INVALID_JSON",
    message: `${field} is not valid JSON: ${(e as Error).message}`,
    name: "ParseError",
  } as unknown as GovernanceMetadataError;
}

export function GenerateTab() {
  const [std, setStd] = useState<Std>("CIP-108");

  // CIP-108
  const [title, setTitle] = useState("Increase Treasury Transparency");
  const [abstract, setAbstract] = useState(
    "A proposal to publish quarterly treasury reports on-chain.",
  );
  const [motivation, setMotivation] = useState(
    "The community needs auditable, predictable reporting.",
  );
  const [rationale, setRationale] = useState(
    "On-chain reports remove ambiguity and build trust.",
  );
  const [references, setReferences] = useState<ParsedReference[]>([]);
  // Markdown importer (CIP-108 authoring format, à la metadata-create.sh)
  const [markdown, setMarkdown] = useState("");
  const [importNote, setImportNote] = useState<string | null>(null);

  // CIP-100
  const [comment, setComment] = useState("Signed off by the working group.");

  // CIP-119
  const [givenName, setGivenName] = useState("Ada Lovelace");
  const [objectives, setObjectives] = useState("Sustainable, transparent governance.");
  const [motivations, setMotivations] = useState("Long-term health of Cardano.");
  const [qualifications, setQualifications] = useState("Active DRep since Chang.");
  const [paymentAddress, setPaymentAddress] = useState("");

  // CIP-136
  const [summary, setSummary] = useState("We vote YES — the action is constitutional.");
  const [rationaleStatement, setRationaleStatement] = useState(
    "After review, the action aligns with the Constitution.",
  );
  const [constitutional, setConstitutional] = useState("5");
  const [unconstitutional, setUnconstitutional] = useState("1");
  const [abstainCount, setAbstainCount] = useState("1");

  // Author (name only — witnesses require signing, out of scope for build())
  const [authorName, setAuthorName] = useState("");

  // @context — URL reference vs inline object, from a chosen source.
  const [ctxMode, setCtxMode] = useState<CtxMode>("url");
  const [ctxSource, setCtxSource] = useState<CtxSource>("library");
  const [ctxCustomUrl, setCtxCustomUrl] = useState("");
  const [inlineCtx, setInlineCtx] = useState<unknown | null>(null);
  const [ctxStatus, setCtxStatus] = useState<React.ReactNode>(null);
  const [ctxBusy, setCtxBusy] = useState(false);
  const [inlineCtxUrl, setInlineCtxUrl] = useState<string | null>(null);

  // CIP-169 on-chain effect
  const [effect, setEffect] = useState<EffectKind>("none");
  // proposal wrapper
  const [deposit, setDeposit] = useState("100000000000");
  const [rewardAccount, setRewardAccount] = useState(
    "stake1uyvjdz9rxsfsmv44rtk75k2rqyqskrga96dgdfrqjvjjpwsefcjnp",
  );
  // parameter_change_action
  const [paramUpdate, setParamUpdate] = useState('{\n  "max_block_body_size": 98304\n}');
  // hard_fork_initiation_action
  const [hfMajor, setHfMajor] = useState("10");
  const [hfMinor, setHfMinor] = useState("0");
  // treasury_withdrawals_action
  const [withdrawKey, setWithdrawKey] = useState(
    "stake17xzc8pt7fgf0lc0x7eq6z7z6puhsxmzktna7dluahrj6g6ghh5qjr",
  );
  const [withdrawValue, setWithdrawValue] = useState("3303750000000");
  // update_committee
  const [ucNum, setUcNum] = useState("2");
  const [ucDen, setUcDen] = useState("3");
  const [ucCommittee, setUcCommittee] = useState(
    '[\n  {\n    "key": { "tag": "pubkey_hash", "value": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8" },\n    "value": 350\n  }\n]',
  );
  const [ucRemove, setUcRemove] = useState("");
  // new_constitution
  const [constitutionJson, setConstitutionJson] = useState(
    '{\n  "anchor": {\n    "url": "https://example.com/constitution.txt",\n    "data_hash": "0000000000000000000000000000000000000000000000000000000000000000"\n  }\n}',
  );
  // certificates — credentials
  const [drepTag, setDrepTag] = useState<Cip169Credential["tag"]>("pubkey_hash");
  const [drepValue, setDrepValue] = useState(
    "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8",
  );
  const [drepCoin, setDrepCoin] = useState("500000000");
  const [ccTag, setCcTag] = useState<Cip169Credential["tag"]>("pubkey_hash");
  const [ccValue, setCcValue] = useState(
    "d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1",
  );
  // voting_procedures
  const [votesJson, setVotesJson] = useState(
    JSON.stringify(
      [
        {
          key: {
            tag: "drep_credential",
            credential: {
              tag: "pubkey_hash",
              value: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8",
            },
          },
          value: [
            {
              key: {
                transaction_id:
                  "e14de8d9dc4f4ddf3fe9250a8a926e20f10e99b86bd0610b77d7a054981591ee",
                gov_action_index: "0",
              },
              value: { vote: "yes" },
            },
          ],
        },
      ],
      null,
      2,
    ),
  );

  function importMarkdown() {
    const p = parseProposalMarkdown(markdown);
    const filled: string[] = [];
    if (p.title) { setTitle(p.title); filled.push("title"); }
    if (p.abstract) { setAbstract(p.abstract); filled.push("abstract"); }
    if (p.motivation) { setMotivation(p.motivation); filled.push("motivation"); }
    if (p.rationale) { setRationale(p.rationale); filled.push("rationale"); }
    setReferences(p.references);
    if (p.references.length) filled.push(`${p.references.length} reference${p.references.length === 1 ? "" : "s"}`);
    setStd("CIP-108");
    setImportNote(
      filled.length ? `Imported ${filled.join(", ")}.` : "No ## Title/Abstract/Motivation/Rationale/References sections found.",
    );
  }

  // The @context URL implied by the current source / standard / action.
  const effectiveContextUrl =
    ctxSource === "custom"
      ? ctxCustomUrl.trim()
      : ctxSource === "intersect"
        ? intersectUrlFor(effect)
        : LIBRARY_CONTEXT_URL[std];

  function invalidateInline() {
    setInlineCtx(null);
    setInlineCtxUrl(null);
    setCtxStatus(null);
  }

  async function resolveInlineContext() {
    const url = effectiveContextUrl;
    if (!url) {
      setCtxStatus(
        <div className="issue">
          <span className="path">context</span>
          <span className="msg">Enter a context URL first.</span>
        </div>,
      );
      return;
    }
    setCtxBusy(true);
    setCtxStatus(null);
    try {
      let ctxObj: unknown;
      let origin: string;
      try {
        // Bundled CIP contexts resolve offline through the library's loader.
        const loader = createDocumentLoader({ policy: "bundled-only" });
        const remote = await loader(url);
        ctxObj = (remote.document as { "@context"?: unknown })["@context"] ?? remote.document;
        origin = "resolved offline (bundled)";
      } catch {
        // Not bundled (e.g. the Intersect schemas) — fetch it, exactly like the
        // script's `curl … | jq '."@context"'`.
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
        const doc = (await resp.json()) as { "@context"?: unknown };
        ctxObj = doc?.["@context"] ?? doc;
        origin = "fetched from network";
      }
      const keys =
        ctxObj && typeof ctxObj === "object" ? Object.keys(ctxObj as object).length : 0;
      setInlineCtx(ctxObj);
      setInlineCtxUrl(url);
      setCtxStatus(
        <ResultBadge tone="valid">{origin} — {keys} keys inlined</ResultBadge>,
      );
    } catch (e) {
      setInlineCtx(null);
      setInlineCtxUrl(null);
      setCtxStatus(
        <div className="issue">
          <span className="path">context</span>
          <span className="msg">{(e as Error).message}</span>
        </div>,
      );
    } finally {
      setCtxBusy(false);
    }
  }

  function updateRef(i: number, patch: Partial<ParsedReference>) {
    setReferences((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function addRef() {
    setReferences((rs) => [...rs, { type: "Other", label: "", uri: "", hashDigest: "" }]);
  }
  function removeRef(i: number) {
    setReferences((rs) => rs.filter((_, j) => j !== i));
  }

  const built = useMemo<
    | { ok: true; json: string; roundtrips: boolean }
    | { ok: false; error: GovernanceMetadataError }
    | null
  >(() => {
    // 1) Optional CIP-169 on-chain payload via the actions factory + build().
    let onChain: OnChain | undefined;
    if (effect !== "none") {
      let onChainInput: OnChain;
      try {
        if (PROPOSAL_ACTIONS.includes(effect)) {
          let gov_action: GovAction;
          switch (effect) {
            case "info_action":
              gov_action = cip169.actions.infoAction();
              break;
            case "no_confidence":
              gov_action = cip169.actions.noConfidence();
              break;
            case "parameter_change_action":
              gov_action = cip169.actions.parameterChange({
                protocol_param_update: JSON.parse(paramUpdate),
              });
              break;
            case "hard_fork_initiation_action":
              gov_action = cip169.actions.hardForkInitiation({
                protocol_version: { major: Number(hfMajor), minor: Number(hfMinor) },
              });
              break;
            case "treasury_withdrawals_action":
              gov_action = cip169.actions.treasuryWithdrawals({
                rewards: [{ key: withdrawKey, value: withdrawValue }],
              });
              break;
            case "update_committee":
              gov_action = cip169.actions.updateCommittee({
                committee: JSON.parse(ucCommittee),
                signature_threshold: {
                  numerator: Number(ucNum),
                  denominator: Number(ucDen),
                },
                ...(ucRemove.trim()
                  ? { members_to_remove: JSON.parse(ucRemove) }
                  : {}),
              });
              break;
            case "new_constitution":
              gov_action = cip169.actions.newConstitution({
                constitution: JSON.parse(constitutionJson),
              });
              break;
            default:
              gov_action = cip169.actions.infoAction();
          }
          onChainInput = { deposit, reward_account: rewardAccount, gov_action };
        } else if (effect === "register_drep") {
          onChainInput = cip169.actions.registerDrep({
            drep_credential: { tag: drepTag, value: drepValue },
            coin: drepCoin,
          });
        } else if (effect === "update_drep") {
          onChainInput = cip169.actions.updateDrep({
            drep_credential: { tag: drepTag, value: drepValue },
          });
        } else if (effect === "resign_committee_cold") {
          onChainInput = cip169.actions.resignCommitteeCold({
            committee_cold_credential: { tag: ccTag, value: ccValue },
          });
        } else {
          // voting_procedures
          onChainInput = cip169.actions.votingProcedures(JSON.parse(votesJson));
        }
      } catch (e) {
        return { ok: false, error: jsonError(e, "on-chain effect input") };
      }

      const payload = cip169.build(onChainInput);
      if (!payload.success) return { ok: false, error: payload.error };
      onChain = payload.data.payload;
    }

    // 2) Resolve the document @context: an inline object once resolved for the
    // current URL, otherwise the URL string itself (build() defaults to it too).
    const inlineReady =
      ctxMode === "inline" && inlineCtx !== null && inlineCtxUrl === effectiveContextUrl;
    const contextValue: unknown = inlineReady ? inlineCtx : effectiveContextUrl || undefined;

    // 3) Assemble the body for the chosen standard.
    const authors = authorName.trim()
      ? [{ name: authorName.trim() }]
      : undefined;

    let result: Result<{ json: string }, GovernanceMetadataError>;
    switch (std) {
      case "CIP-100":
        result = cip100.build({
          body: { comment, ...(onChain ? { onChain } : {}) },
          authors,
          context: contextValue,
        });
        break;
      case "CIP-108": {
        const refs: HashedReference[] = references
          .filter((r) => r.label.trim() && r.uri.trim())
          .map((r) => ({
            "@type": r.type,
            label: r.label.trim(),
            uri: r.uri.trim(),
            ...(r.hashDigest.trim()
              ? {
                  referenceHash: {
                    hashDigest: r.hashDigest.trim(),
                    hashAlgorithm: "blake2b-256",
                  },
                }
              : {}),
          }));
        result = cip108.build({
          body: {
            title,
            abstract,
            motivation,
            rationale,
            ...(refs.length ? { references: refs } : {}),
            ...(onChain ? { onChain } : {}),
          },
          authors,
          context: contextValue,
        });
        break;
      }
      case "CIP-119":
        result = cip119.build({
          body: {
            givenName,
            ...(objectives ? { objectives } : {}),
            ...(motivations ? { motivations } : {}),
            ...(qualifications ? { qualifications } : {}),
            ...(paymentAddress ? { paymentAddress } : {}),
            ...(onChain ? { onChain } : {}),
          },
          authors,
          context: contextValue,
        });
        break;
      case "CIP-136": {
        const internalVote = {
          ...(constitutional ? { constitutional: Number(constitutional) } : {}),
          ...(unconstitutional
            ? { unconstitutional: Number(unconstitutional) }
            : {}),
          ...(abstainCount ? { abstain: Number(abstainCount) } : {}),
        };
        result = cip136.build({
          body: {
            summary,
            rationaleStatement,
            ...(Object.keys(internalVote).length ? { internalVote } : {}),
            ...(onChain ? { onChain } : {}),
          },
          authors,
          context: contextValue,
        });
        break;
      }
    }

    if (!result.success) return { ok: false, error: result.error };

    // 3) Prove the output round-trips through parse() for the same standard.
    const mod = { "CIP-100": cip100, "CIP-108": cip108, "CIP-119": cip119, "CIP-136": cip136 }[std];
    const roundtrips = mod.parse(result.data.json).success;
    return { ok: true, json: result.data.json, roundtrips };
  }, [
    std, title, abstract, motivation, rationale, references, comment, givenName, objectives,
    motivations, qualifications, paymentAddress, summary, rationaleStatement,
    constitutional, unconstitutional, abstainCount, authorName, effect, deposit,
    rewardAccount, paramUpdate, hfMajor, hfMinor, withdrawKey, withdrawValue,
    ucNum, ucDen, ucCommittee, ucRemove, constitutionJson, drepTag, drepValue,
    drepCoin, ccTag, ccValue, votesJson,
    ctxMode, inlineCtx, inlineCtxUrl, effectiveContextUrl,
  ]);

  const isProposal = PROPOSAL_ACTIONS.includes(effect);
  const inlineActive =
    ctxMode === "inline" && inlineCtx !== null && inlineCtxUrl === effectiveContextUrl;

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <h2>Generate new metadata</h2>
          <span className="api-tag">cipNNN.build · cip169.build · actions</span>
        </div>
        <p className="sub">
          Fill in the fields and a valid, publishable document is built live.
          Each <code>build()</code> validates against the same schema as{" "}
          <code>validate()</code>, so a successful build is guaranteed to
          round-trip through <code>parse()</code>.
        </p>

        <div className="pill-group" style={{ marginBottom: 18 }}>
          {(Object.keys(STD_INFO) as Std[]).map((s) => (
            <button
              key={s}
              aria-pressed={std === s}
              onClick={() => setStd(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="hint" style={{ marginTop: -8 }}>{STD_INFO[std]}</p>

        <div className="ctx-control">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <span className="section-label" style={{ margin: 0 }}>
              @context
            </span>
            <div className="pill-group">
              <button aria-pressed={ctxMode === "url"} onClick={() => { setCtxMode("url"); setCtxStatus(null); }}>
                URL reference
              </button>
              <button aria-pressed={ctxMode === "inline"} onClick={() => setCtxMode("inline")}>
                Inline object
              </button>
            </div>
          </div>

          <div className="row" style={{ marginTop: 10, alignItems: "flex-end" }}>
            <label className="field" style={{ minWidth: 260 }}>
              <span className="field-label">source</span>
              <select
                value={ctxSource}
                onChange={(e) => { setCtxSource(e.target.value as CtxSource); invalidateInline(); }}
              >
                <option value="library">CIP default (bundled · offline)</option>
                <option value="intersect">Intersect governance-actions (metadata-create.sh)</option>
                <option value="custom">Custom URL…</option>
              </select>
            </label>
            {ctxSource === "custom" && (
              <div style={{ flex: 1 }}>
                <Field
                  label="context URL"
                  value={ctxCustomUrl}
                  onChange={(v) => { setCtxCustomUrl(v); invalidateInline(); }}
                  mono
                />
              </div>
            )}
          </div>

          <div className="kvline" style={{ marginTop: 10 }}>
            <span className="k">{inlineActive ? "inlined from" : "resolves to"}</span>
            <span className="mono-chip" style={{ border: "none", background: "none", padding: 0, wordBreak: "break-all" }}>
              {effectiveContextUrl || "—"}
            </span>
          </div>

          {ctxMode === "inline" && (
            <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
              <button className="btn" onClick={resolveInlineContext} disabled={ctxBusy || !effectiveContextUrl}>
                {ctxBusy ? <span className="spinner" /> : "Resolve & inline"}
              </button>
              {!inlineActive && (
                <span className="hint" style={{ margin: 0 }}>
                  Embeds the <code>@context</code> object (bundled offline, else fetched like the
                  script's <code>curl</code>). Until resolved, the URL is used.
                </span>
              )}
            </div>
          )}
          {ctxStatus && <div style={{ marginTop: 8 }}>{ctxStatus}</div>}
        </div>

        <div className="cols">
          <div className="stack">
            {std === "CIP-100" && (
              <Field label="comment" value={comment} onChange={setComment} textarea />
            )}

            {std === "CIP-108" && (
              <>
                <details className="importer">
                  <summary>Import from Markdown</summary>
                  <p className="hint" style={{ marginTop: 8 }}>
                    Paste a proposal in the{" "}
                    <code>metadata-create.sh</code> authoring format —{" "}
                    <code>## Title</code> / <code>## Abstract</code> /{" "}
                    <code>## Motivation</code> / <code>## Rationale</code>{" "}
                    sections, plus <code>## References</code> as{" "}
                    <code>* [label](url)</code> bullets.
                  </p>
                  <textarea
                    className="mono"
                    rows={8}
                    value={markdown}
                    onChange={(e) => setMarkdown(e.target.value)}
                    placeholder={"## Title\nIncrease Treasury Transparency\n\n## Abstract\n…\n\n## References\n* [CIP-1694](https://cips.cardano.org/cip/CIP-1694)"}
                  />
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="btn primary" onClick={importMarkdown} disabled={!markdown.trim()}>
                      Import sections
                    </button>
                    {importNote && <span className="hint" style={{ margin: 0 }}>{importNote}</span>}
                  </div>
                </details>
                <Field label="title" value={title} onChange={setTitle} maxLength={80} />
                <Field label="abstract" value={abstract} onChange={setAbstract} maxLength={2500} textarea />
                <Field label="motivation" value={motivation} onChange={setMotivation} textarea />
                <Field label="rationale" value={rationale} onChange={setRationale} textarea />
                <ReferencesEditor
                  references={references}
                  onUpdate={updateRef}
                  onAdd={addRef}
                  onRemove={removeRef}
                />
              </>
            )}

            {std === "CIP-119" && (
              <>
                <Field label="givenName" value={givenName} onChange={setGivenName} maxLength={80} />
                <Field label="objectives" value={objectives} onChange={setObjectives} maxLength={1000} textarea />
                <Field label="motivations" value={motivations} onChange={setMotivations} maxLength={1000} textarea />
                <Field label="qualifications" value={qualifications} onChange={setQualifications} maxLength={1000} textarea />
                <Field label="paymentAddress (optional)" value={paymentAddress} onChange={setPaymentAddress} mono />
              </>
            )}

            {std === "CIP-136" && (
              <>
                <Field label="summary" value={summary} onChange={setSummary} maxLength={300} textarea />
                <Field label="rationaleStatement" value={rationaleStatement} onChange={setRationaleStatement} textarea />
                <p className="section-label" style={{ marginTop: 4 }}>internalVote</p>
                <div className="row">
                  <Field label="constitutional" value={constitutional} onChange={setConstitutional} type="number" />
                  <Field label="unconstitutional" value={unconstitutional} onChange={setUnconstitutional} type="number" />
                  <Field label="abstain" value={abstainCount} onChange={setAbstainCount} type="number" />
                </div>
              </>
            )}

            <div className="divider" />
            <Field
              label="author name (optional — witnesses require signing, out of scope)"
              value={authorName}
              onChange={setAuthorName}
            />
          </div>

          <div className="stack">
            <p className="section-label" style={{ margin: 0 }}>
              CIP-169 on-chain effect (optional)
            </p>
            <p className="hint" style={{ marginTop: -6 }}>
              Bind this metadata to a specific on-chain action via{" "}
              <code>body.onChain</code>. Each option calls the matching{" "}
              <code>cip169.actions.*</code> factory.
            </p>
            <label className="field">
              <span className="field-label">effect</span>
              <select value={effect} onChange={(e) => setEffect(e.target.value as EffectKind)}>
                <option value="none">— none —</option>
                <optgroup label="Proposal · gov_action">
                  <option value="info_action">info_action</option>
                  <option value="parameter_change_action">parameter_change_action</option>
                  <option value="hard_fork_initiation_action">hard_fork_initiation_action</option>
                  <option value="treasury_withdrawals_action">treasury_withdrawals_action</option>
                  <option value="no_confidence">no_confidence</option>
                  <option value="update_committee">update_committee</option>
                  <option value="new_constitution">new_constitution</option>
                </optgroup>
                <optgroup label="Certificate">
                  <option value="register_drep">register_drep</option>
                  <option value="update_drep">update_drep</option>
                  <option value="resign_committee_cold">resign_committee_cold</option>
                </optgroup>
                <optgroup label="Voting procedures">
                  <option value="voting_procedures">voting_procedures</option>
                </optgroup>
              </select>
            </label>

            {/* Proposal wrapper — only proposal actions carry deposit + reward_account. */}
            {isProposal && (
              <>
                <Field label="deposit (lovelace)" value={deposit} onChange={setDeposit} mono />
                <Field label="reward_account" value={rewardAccount} onChange={setRewardAccount} mono />
              </>
            )}

            {effect === "parameter_change_action" && (
              <Field label="protocol_param_update (JSON)" value={paramUpdate} onChange={setParamUpdate} textarea mono />
            )}
            {effect === "hard_fork_initiation_action" && (
              <div className="row">
                <Field label="protocol_version.major" value={hfMajor} onChange={setHfMajor} type="number" />
                <Field label="protocol_version.minor" value={hfMinor} onChange={setHfMinor} type="number" />
              </div>
            )}
            {effect === "treasury_withdrawals_action" && (
              <>
                <Field label="reward key (stake address)" value={withdrawKey} onChange={setWithdrawKey} mono />
                <Field label="reward value (lovelace)" value={withdrawValue} onChange={setWithdrawValue} mono />
              </>
            )}
            {effect === "update_committee" && (
              <>
                <div className="row">
                  <Field label="threshold numerator" value={ucNum} onChange={setUcNum} type="number" />
                  <Field label="threshold denominator" value={ucDen} onChange={setUcDen} type="number" />
                </div>
                <Field label="committee (JSON: [{ key: Credential, value: epoch }])" value={ucCommittee} onChange={setUcCommittee} textarea mono />
                <Field label="members_to_remove (optional JSON: Credential[])" value={ucRemove} onChange={setUcRemove} textarea mono />
              </>
            )}
            {effect === "new_constitution" && (
              <Field label="constitution (JSON: { anchor, script_hash? })" value={constitutionJson} onChange={setConstitutionJson} textarea mono />
            )}
            {(effect === "register_drep" || effect === "update_drep") && (
              <CredentialFields
                label="drep_credential"
                tag={drepTag}
                value={drepValue}
                onTag={setDrepTag}
                onValue={setDrepValue}
              />
            )}
            {effect === "register_drep" && (
              <Field label="coin (deposit, lovelace)" value={drepCoin} onChange={setDrepCoin} mono />
            )}
            {effect === "resign_committee_cold" && (
              <CredentialFields
                label="committee_cold_credential"
                tag={ccTag}
                value={ccValue}
                onTag={setCcTag}
                onValue={setCcValue}
              />
            )}
            {effect === "voting_procedures" && (
              <Field label="voting procedures (JSON array)" value={votesJson} onChange={setVotesJson} textarea mono rows={12} />
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Document</h2>
          {built?.ok && (
            <ResultBadge tone={built.roundtrips ? "valid" : "warn"}>
              {built.roundtrips ? "round-trips through parse()" : "built, parse mismatch"}
            </ResultBadge>
          )}
        </div>
        {built === null ? (
          <p className="muted">Fill in the form to generate a document.</p>
        ) : built.ok ? (
          <JsonView title={`${std} metadata`} text={built.json} download={`${std.toLowerCase()}-metadata.jsonld`} />
        ) : (
          <IssueList error={built.error} />
        )}
      </section>
    </>
  );
}

/** CIP-108 `references` editor — a list of typed { label, uri } links. */
function ReferencesEditor({
  references,
  onUpdate,
  onAdd,
  onRemove,
}: {
  references: ParsedReference[];
  onUpdate: (i: number, patch: Partial<ParsedReference>) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="section-label" style={{ margin: 0 }}>
          references (optional)
        </span>
        <button className="btn tiny ghost" onClick={onAdd}>
          + add reference
        </button>
      </div>
      {references.length === 0 ? (
        <p className="hint" style={{ marginTop: -4 }}>
          None — add links to supporting material, or import them from Markdown.
        </p>
      ) : (
        references.map((r, i) => (
          <div className="ref-row" key={i}>
            <select
              value={r.type}
              onChange={(e) => onUpdate(i, { type: e.target.value as ParsedReference["type"] })}
            >
              <option value="Other">Other</option>
              <option value="GovernanceMetadata">GovernanceMetadata</option>
            </select>
            <input
              type="text"
              placeholder="label"
              value={r.label}
              onChange={(e) => onUpdate(i, { label: e.target.value })}
            />
            <input
              type="text"
              className="mono"
              placeholder="https://… or ipfs://…"
              value={r.uri}
              onChange={(e) => onUpdate(i, { uri: e.target.value })}
            />
            <input
              type="text"
              className="mono"
              placeholder="referenceHash hex (optional)"
              value={r.hashDigest}
              onChange={(e) => onUpdate(i, { hashDigest: e.target.value })}
            />
            <button className="btn tiny ghost" onClick={() => onRemove(i)} title="remove">
              ×
            </button>
          </div>
        ))
      )}
    </div>
  );
}

/** Inline editor for a CIP-169 Credential ({ tag, value }). */
function CredentialFields({
  label,
  tag,
  value,
  onTag,
  onValue,
}: {
  label: string;
  tag: Cip169Credential["tag"];
  value: string;
  onTag: (t: Cip169Credential["tag"]) => void;
  onValue: (v: string) => void;
}) {
  return (
    <div className="row" style={{ alignItems: "flex-end" }}>
      <label className="field" style={{ minWidth: 160 }}>
        <span className="field-label">{label}.tag</span>
        <select value={tag} onChange={(e) => onTag(e.target.value as Cip169Credential["tag"])}>
          <option value="pubkey_hash">pubkey_hash</option>
          <option value="script_hash">script_hash</option>
        </select>
      </label>
      <div style={{ flex: 1 }}>
        <Field label={`${label}.value (hex)`} value={value} onChange={onValue} mono />
      </div>
    </div>
  );
}
