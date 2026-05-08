/**
 * Strips the self-referential `anchor` fields per CIP-169.
 *
 * Removed (these point at the metadata document itself):
 * - top-level `anchor` on a ProposalProcedure / register_drep / update_drep / resign_committee_cold
 * - inner `anchor` on each VotingProcedure
 *
 * Retained:
 * - `Constitution.anchor` inside a `new_constitution` action — points at the constitution document, a separate artifact.
 *
 * Idempotent and pure: returns a new object, never mutates input.
 */
export function stripSelfAnchor<T>(value: T): T {
  return strip(value) as T;
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => stripVotingPair(v));
  }
  if (!isObject(value)) return value;

  const obj = value as Record<string, unknown>;

  if (typeof obj.tag === "string" && CERT_NO_ANCHOR_TAGS.has(obj.tag)) {
    const { anchor: _drop, ...rest } = obj;
    return rest;
  }

  if ("gov_action" in obj && "deposit" in obj && "reward_account" in obj) {
    const { anchor: _drop, gov_action, ...rest } = obj;
    return { ...rest, gov_action: stripGovAction(gov_action) };
  }

  return obj;
}

function stripVotingPair(pair: unknown): unknown {
  if (!isObject(pair)) return pair;
  const obj = pair as Record<string, unknown>;
  if (!("value" in obj)) return obj;
  if (!Array.isArray(obj.value)) return obj;
  const innerStripped = obj.value.map((entry) => {
    if (!isObject(entry)) return entry;
    const innerObj = entry as Record<string, unknown>;
    if (!isObject(innerObj.value)) return innerObj;
    const procedure = innerObj.value as Record<string, unknown>;
    const { anchor: _drop, ...procRest } = procedure;
    return { ...innerObj, value: procRest };
  });
  return { ...obj, value: innerStripped };
}

function stripGovAction(govAction: unknown): unknown {
  return govAction;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const CERT_NO_ANCHOR_TAGS = new Set([
  "register_drep",
  "update_drep",
  "resign_committee_cold",
]);
