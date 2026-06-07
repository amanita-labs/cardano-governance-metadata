/**
 * Bundled sample data — real fixtures from the library's own test corpus,
 * imported as raw strings so the playground runs fully offline. These are the
 * same documents used in `docs/examples/fixtures/`.
 */

// Governance-action metadata (full CIP-108 documents with witnesses + onChain)
import tweagMeta from "../../docs/examples/fixtures/governance-actions/tweag-twa/metadata.jsonld?raw";
import tweagAction from "../../docs/examples/fixtures/governance-actions/tweag-twa/metadata.jsonld.action?raw";
import emurgoMeta from "../../docs/examples/fixtures/governance-actions/emurgo-sponsorship/metadata.jsonld?raw";
import emurgoAction from "../../docs/examples/fixtures/governance-actions/emurgo-sponsorship/metadata.jsonld.action?raw";
import infoMeta from "../../docs/examples/fixtures/governance-actions/budget-process-info/metadata.jsonld?raw";
import infoAction from "../../docs/examples/fixtures/governance-actions/budget-process-info/metadata.jsonld.action?raw";

// CIP-169 standalone examples (onChain payloads nested in minimal documents)
import twExample from "../../docs/examples/fixtures/cip-0169/treasury-withdrawal.jsonld?raw";
import pcExample from "../../docs/examples/fixtures/cip-0169/parameter-change.jsonld?raw";
import voteExample from "../../docs/examples/fixtures/cip-0169/vote.jsonld?raw";

export interface MetadataSample {
  id: string;
  label: string;
  note: string;
  /** Pretty-printed metadata JSON. */
  json: string;
  /** Conway tx CBOR hex from the matching on-chain proposal, if available. */
  txCborHex?: string;
}

/** Pull the `cborHex` out of a `.action` file (Cardano CLI envelope JSON). */
function cborFromAction(raw: string): string | undefined {
  try {
    return JSON.parse(raw).cborHex as string;
  } catch {
    return undefined;
  }
}

export const METADATA_SAMPLES: MetadataSample[] = [
  {
    id: "tweag",
    label: "Tweag Treasury Withdrawal",
    note: "CIP-108 + CIP-169 · 1 ed25519 witness · matching on-chain proposal",
    json: tweagMeta,
    txCborHex: cborFromAction(tweagAction),
  },
  {
    id: "emurgo",
    label: "EMURGO TOKEN2049 Sponsorship",
    note: "CIP-108 + CIP-169 · 2 witnesses (ed25519 + CIP-8/COSE) · on-chain proposal",
    json: emurgoMeta,
    txCborHex: cborFromAction(emurgoAction),
  },
  {
    id: "info",
    label: "Budget Process (Info Action)",
    note: "CIP-108 + CIP-169 info_action · 1 ed25519 witness",
    json: infoMeta,
    txCborHex: cborFromAction(infoAction),
  },
];

/** Raw CIP-169 example documents, used to seed the On-Chain compare editors. */
export const ONCHAIN_EXAMPLES: { id: string; label: string; json: string }[] = [
  { id: "tw", label: "Treasury withdrawal", json: twExample },
  { id: "pc", label: "Parameter change", json: pcExample },
  { id: "vote", label: "Vote", json: voteExample },
];

/** Extract the `body.onChain` payload from a full metadata document string. */
export function extractOnChain(json: string): string {
  try {
    const doc = JSON.parse(json);
    const onChain = doc?.body?.onChain;
    return onChain ? JSON.stringify(onChain, null, 2) : json;
  } catch {
    return json;
  }
}
