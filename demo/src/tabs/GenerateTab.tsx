import { useMemo, useState } from "react";
import { cip100, cip108, cip119, cip136, cip169 } from "../lib";
import type { GovernanceMetadataError, OnChain, Result } from "../lib";
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

type ActionKind =
  | "none"
  | "info_action"
  | "treasury_withdrawals_action"
  | "no_confidence"
  | "parameter_change_action";

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

  // CIP-169 on-chain effect
  const [action, setAction] = useState<ActionKind>("none");
  const [deposit, setDeposit] = useState("100000000000");
  const [rewardAccount, setRewardAccount] = useState(
    "stake1uyvjdz9rxsfsmv44rtk75k2rqyqskrga96dgdfrqjvjjpwsefcjnp",
  );
  const [withdrawKey, setWithdrawKey] = useState(
    "stake17xzc8pt7fgf0lc0x7eq6z7z6puhsxmzktna7dluahrj6g6ghh5qjr",
  );
  const [withdrawValue, setWithdrawValue] = useState("3303750000000");
  const [paramUpdate, setParamUpdate] = useState('{\n  "0": 100\n}');

  const built = useMemo<
    | { ok: true; json: string; roundtrips: boolean }
    | { ok: false; error: GovernanceMetadataError }
    | null
  >(() => {
    // 1) Optional CIP-169 on-chain payload via the actions factory + build().
    let onChain: OnChain | undefined;
    if (action !== "none") {
      let gov_action;
      try {
        switch (action) {
          case "info_action":
            gov_action = cip169.actions.infoAction();
            break;
          case "no_confidence":
            gov_action = cip169.actions.noConfidence();
            break;
          case "treasury_withdrawals_action":
            gov_action = cip169.actions.treasuryWithdrawals({
              rewards: [{ key: withdrawKey, value: withdrawValue }],
            });
            break;
          case "parameter_change_action":
            gov_action = cip169.actions.parameterChange({
              protocol_param_update: JSON.parse(paramUpdate),
            });
            break;
        }
      } catch (e) {
        return {
          ok: false,
          error: {
            code: "INVALID_JSON",
            message: `protocol_param_update is not valid JSON: ${(e as Error).message}`,
            name: "ParseError",
          } as unknown as GovernanceMetadataError,
        };
      }
      const payload = cip169.build({
        deposit,
        reward_account: rewardAccount,
        gov_action,
      });
      if (!payload.success) return { ok: false, error: payload.error };
      onChain = payload.data.payload;
    }

    // 2) Assemble the body for the chosen standard.
    const authors = authorName.trim()
      ? [{ name: authorName.trim() }]
      : undefined;

    let result: Result<{ json: string }, GovernanceMetadataError>;
    switch (std) {
      case "CIP-100":
        result = cip100.build({
          body: { comment, ...(onChain ? { onChain } : {}) },
          authors,
        });
        break;
      case "CIP-108":
        result = cip108.build({
          body: {
            title,
            abstract,
            motivation,
            rationale,
            ...(onChain ? { onChain } : {}),
          },
          authors,
        });
        break;
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
    std, title, abstract, motivation, rationale, comment, givenName, objectives,
    motivations, qualifications, paymentAddress, summary, rationaleStatement,
    constitutional, unconstitutional, abstainCount, authorName, action, deposit,
    rewardAccount, withdrawKey, withdrawValue, paramUpdate,
  ]);

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

        <div className="cols">
          <div className="stack">
            {std === "CIP-100" && (
              <Field label="comment" value={comment} onChange={setComment} textarea />
            )}

            {std === "CIP-108" && (
              <>
                <Field label="title" value={title} onChange={setTitle} maxLength={80} />
                <Field label="abstract" value={abstract} onChange={setAbstract} maxLength={2500} textarea />
                <Field label="motivation" value={motivation} onChange={setMotivation} textarea />
                <Field label="rationale" value={rationale} onChange={setRationale} textarea />
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
              Bind this metadata to a specific on-chain governance action via{" "}
              <code>body.onChain</code>.
            </p>
            <label className="field">
              <span className="field-label">gov_action.tag</span>
              <select value={action} onChange={(e) => setAction(e.target.value as ActionKind)}>
                <option value="none">— none —</option>
                <option value="info_action">info_action</option>
                <option value="treasury_withdrawals_action">treasury_withdrawals_action</option>
                <option value="no_confidence">no_confidence</option>
                <option value="parameter_change_action">parameter_change_action</option>
              </select>
            </label>

            {action !== "none" && (
              <>
                <Field label="deposit (lovelace)" value={deposit} onChange={setDeposit} mono />
                <Field label="reward_account" value={rewardAccount} onChange={setRewardAccount} mono />
              </>
            )}
            {action === "treasury_withdrawals_action" && (
              <>
                <Field label="reward key (stake address)" value={withdrawKey} onChange={setWithdrawKey} mono />
                <Field label="reward value (lovelace)" value={withdrawValue} onChange={setWithdrawValue} mono />
              </>
            )}
            {action === "parameter_change_action" && (
              <Field label="protocol_param_update (JSON)" value={paramUpdate} onChange={setParamUpdate} textarea mono />
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
