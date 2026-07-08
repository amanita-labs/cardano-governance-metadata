/**
 * Decode a *bare* governance value — a cardano-cli TextEnvelope
 * (`{ type, description, cborHex }`) or its raw CBOR — into the CIP-169
 * no-anchor shape, for verifying metadata against artifacts produced by
 * `cardano-cli conway governance ...` without needing the full transaction.
 */
import {
	ErrorCode,
	GovernanceMetadataError,
	ParseError,
} from "../../core/errors.js";
import { bytesToHex } from "../../core/hex.js";
import type { Result } from "../../core/types.js";
import type {
	Anchor,
	DecodedGovEnvelope,
	GovEnvelopeKind,
	OnChain,
} from "../types.js";
import {
	encodeAnchor,
	encodeCertNoAnchor,
	encodeProposalProcedureNoAnchor,
	encodeVotingProceduresNoAnchor,
} from "./cip116-encode.js";
import { requireCsl } from "./csl-loader.js";

// biome-ignore lint/suspicious/noExplicitAny: see csl-loader.ts
type CslValue = any;

export type GovEnvelopeInput =
	| string
	| Uint8Array
	| { type?: string; description?: string; cborHex: string };

export interface DecodeGovEnvelopeOptions {
	/**
	 * Force the envelope kind. Required for raw CBOR whose TextEnvelope
	 * `type` is absent; otherwise each kind is tried in order
	 * (proposalProcedure, votingProcedures, certificate).
	 */
	kind?: GovEnvelopeKind;
}

/** cardano-cli TextEnvelope `type` → CIP-169 envelope kind. */
const ENVELOPE_TYPE_TO_KIND: Readonly<Record<string, GovEnvelopeKind>> = {
	"Governance proposal": "proposalProcedure",
	"Governance voting procedures": "votingProcedures",
	Certificate: "certificate",
};

const KIND_ORDER: readonly GovEnvelopeKind[] = [
	"proposalProcedure",
	"votingProcedures",
	"certificate",
];

/**
 * Decode a bare governance envelope into `{ kind, onChain, anchors }`.
 *
 * Accepts a TextEnvelope object, its JSON string, a raw CBOR hex string, or
 * raw CBOR bytes. The returned `onChain` has anchors omitted per CIP-0169
 * and can be compared directly against a metadata document's
 * `body.onChain`; the omitted anchors are returned in `anchors` so callers
 * can check the on-chain `data_hash` against the metadata file hash.
 *
 * Requires `cip169.setCardanoSerializationLib(CSL)` to have been called
 * first; otherwise returns `CSL_NOT_INITIALIZED`.
 */
export function decodeGovEnvelope(
	input: GovEnvelopeInput,
	options?: DecodeGovEnvelopeOptions,
): Result<DecodedGovEnvelope, GovernanceMetadataError> {
	try {
		requireCsl();
	} catch (err) {
		if (err instanceof GovernanceMetadataError) {
			return { success: false, error: err };
		}
		throw err;
	}

	let hex: string;
	let declaredKind: GovEnvelopeKind | undefined;

	try {
		({ hex, declaredKind } = normalizeInput(input));
	} catch (err) {
		return {
			success: false,
			error: new ParseError(
				ErrorCode.TX_DECODE_FAILED,
				`Failed to read governance envelope: ${err instanceof Error ? err.message : String(err)}`,
				err,
			),
		};
	}

	const kind = options?.kind ?? declaredKind;
	const kindsToTry = kind ? [kind] : KIND_ORDER;
	const failures: string[] = [];

	for (const candidate of kindsToTry) {
		try {
			return { success: true, data: decodeAs(candidate, hex) };
		} catch (err) {
			failures.push(
				`${candidate}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	return {
		success: false,
		error: new ParseError(
			ErrorCode.TX_DECODE_FAILED,
			`Failed to decode governance envelope (${failures.join("; ")})`,
		),
	};
}

function normalizeInput(input: GovEnvelopeInput): {
	hex: string;
	declaredKind: GovEnvelopeKind | undefined;
} {
	if (input instanceof Uint8Array) {
		return { hex: bytesToHex(input), declaredKind: undefined };
	}
	if (typeof input === "string") {
		const trimmed = input.trim();
		if (trimmed.startsWith("{")) {
			return normalizeInput(JSON.parse(trimmed) as GovEnvelopeInput);
		}
		return { hex: trimmed, declaredKind: undefined };
	}
	if (typeof input === "object" && input !== null && "cborHex" in input) {
		if (typeof input.cborHex !== "string" || input.cborHex.length === 0) {
			throw new Error("TextEnvelope has no cborHex");
		}
		const declaredKind =
			typeof input.type === "string"
				? ENVELOPE_TYPE_TO_KIND[input.type]
				: undefined;
		if (typeof input.type === "string" && !declaredKind) {
			throw new Error(
				`TextEnvelope type ${JSON.stringify(input.type)} is not a governance proposal, voting procedures, or certificate`,
			);
		}
		return { hex: input.cborHex, declaredKind };
	}
	throw new Error("unsupported envelope input");
}

function decodeAs(kind: GovEnvelopeKind, hex: string): DecodedGovEnvelope {
	const csl = requireCsl();
	const handles: Array<{ free?: () => void }> = [];
	// Guards undefined: several CSL accessors (cert variants, optional
	// anchors) return undefined rather than a handle.
	const track = <T extends { free?: () => void } | undefined>(h: T): T => {
		if (h) handles.push(h);
		return h;
	};

	try {
		switch (kind) {
			case "proposalProcedure": {
				const proposal = track(csl.VotingProposal.from_hex(hex));
				const anchor = track(proposal.anchor());
				return {
					kind,
					onChain: encodeProposalProcedureNoAnchor(proposal),
					anchors: anchor ? [encodeAnchor(anchor)] : [],
				};
			}
			case "votingProcedures": {
				const procedures = track(csl.VotingProcedures.from_hex(hex));
				return {
					kind,
					onChain: encodeVotingProceduresNoAnchor(procedures),
					anchors: collectVotingProcedureAnchors(procedures, track),
				};
			}
			case "certificate": {
				const cert = track(csl.Certificate.from_hex(hex));
				const onChain = encodeCertNoAnchor(cert);
				if (!onChain) {
					throw new Error(
						`certificate kind=${cert.kind()} is not bound by CIP-0169`,
					);
				}
				return {
					kind,
					onChain: onChain as OnChain,
					anchors: collectCertAnchor(cert, track),
				};
			}
			default:
				throw new Error(`Unknown envelope kind ${kind satisfies never}`);
		}
	} finally {
		for (let i = handles.length - 1; i >= 0; i--) {
			try {
				handles[i].free?.();
			} catch {
				// best-effort cleanup
			}
		}
	}
}

function collectVotingProcedureAnchors(
	votingProcedures: CslValue,
	track: <T extends { free?: () => void } | undefined>(h: T) => T,
): Anchor[] {
	const anchors: Anchor[] = [];
	const voters = track(votingProcedures.get_voters());
	const votersLen = voters.len();
	for (let i = 0; i < votersLen; i++) {
		const voter = track(voters.get(i));
		if (!voter) continue;
		const ids = track(
			votingProcedures.get_governance_action_ids_by_voter(voter),
		);
		const idsLen = ids.len();
		for (let j = 0; j < idsLen; j++) {
			const id = track(ids.get(j));
			if (!id) continue;
			const procedure = track(votingProcedures.get(voter, id));
			if (!procedure) continue;
			const anchor = track(procedure.anchor());
			if (anchor) anchors.push(encodeAnchor(anchor));
		}
	}
	return anchors;
}

function collectCertAnchor(
	cert: CslValue,
	track: <T extends { free?: () => void } | undefined>(h: T) => T,
): Anchor[] {
	const inner =
		track(cert.as_drep_registration()) ??
		track(cert.as_drep_update()) ??
		track(cert.as_committee_cold_resign());
	if (!inner) return [];
	const anchor = track(inner.anchor());
	return anchor ? [encodeAnchor(anchor)] : [];
}
