import {
	ErrorCode,
	GovernanceMetadataError,
	ValidationError,
} from "../core/errors.js";
import type { Result } from "../core/types.js";
import {
	type DecodeGovEnvelopeOptions,
	type GovEnvelopeInput,
	decodeGovEnvelope,
} from "./conway/decode-envelope.js";
import { decodeConwayTx } from "./conway/decode-tx.js";
import { stripSelfAnchor } from "./strip-self-anchor.js";
import type {
	CertNoAnchor,
	OnChain,
	OnChainCompareResult,
	OnChainDifference,
	ProposalProcedureNoAnchor,
	Selector,
	VerifyAgainstEnvelopeResult,
	VerifyAgainstTxResult,
	VotingProceduresNoAnchor,
} from "./types.js";

export interface CompareOptions {
	stripSelfAnchor?: boolean;
}

/**
 * Deep-equal two CIP-0116-shaped on-chain values, returning a structured
 * diff if they don't match.
 *
 * By default, self-referential anchors are stripped from both inputs before
 * comparison (see `stripSelfAnchor`) — these point at the metadata document
 * itself and would otherwise create false mismatches. Pass
 * `{ stripSelfAnchor: false }` to disable.
 *
 * `data.differences` is an array of `{ path, metadataValue, actionValue }`.
 * Paths use dot/bracket notation (`gov_action.rewards[0].key`).
 */
export function compareOnChain(
	metadataOnChain: unknown,
	cip116Action: unknown,
	options?: CompareOptions,
): Result<OnChainCompareResult, ValidationError> {
	const strip = options?.stripSelfAnchor !== false;
	const stripped = strip
		? [stripSelfAnchor(metadataOnChain), stripSelfAnchor(cip116Action)]
		: [metadataOnChain, cip116Action];
	const left = normalizeNumericFields(stripped[0]);
	const right = normalizeNumericFields(stripped[1]);

	const differences: OnChainDifference[] = [];
	diff(left, right, "", differences);

	return {
		success: true,
		data: { equal: differences.length === 0, differences },
	};
}

/**
 * Fields the on-chain schema admits as string|number for backwards-compat
 * (typed as such because metadata authors may serialize them either way).
 * The CIP-116 encoder emits the spec-correct numeric form; we coerce the
 * metadata side so a value of `"7"` does not spuriously diff against `7`.
 */
const NUMERIC_FIELD_NAMES = new Set<string>(["gov_action_index"]);

function normalizeNumericFields(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(normalizeNumericFields);
	}
	if (!isObject(value)) return value;
	const out: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(value)) {
		if (NUMERIC_FIELD_NAMES.has(key) && typeof val === "string") {
			const n = Number(val);
			out[key] = Number.isFinite(n) && String(n) === val ? n : val;
		} else {
			out[key] = normalizeNumericFields(val);
		}
	}
	return out;
}

export interface VerifyAgainstTxOptions extends CompareOptions {
	selector?: Selector;
}

/**
 * Verify a metadata document's `body.onChain` against a Conway-era
 * transaction. Decodes `txCbor` via the registered CSL build, picks the
 * matching `proposalProcedure` / `certificate` / `votingProcedures` (using
 * `options.selector` to disambiguate when multiple are present), and
 * delegates to `compareOnChain`.
 *
 * Returns:
 * - `{ matched: true, selectorUsed }` on a successful match,
 * - `{ matched: false, differences, selectorUsed }` when the structures
 *   diverge,
 * - or a top-level error (`success: false`) for missing `body.onChain`,
 *   undecodable CBOR, ambiguous selectors, etc.
 */
export async function verifyAgainstTx(
	metadata: unknown,
	txCbor: Uint8Array | string,
	options?: VerifyAgainstTxOptions,
): Promise<Result<VerifyAgainstTxResult, GovernanceMetadataError>> {
	const onChain = extractOnChain(metadata);
	if (!onChain) {
		return {
			success: false,
			error: new ValidationError([
				{
					path: "body.onChain",
					message: "metadata document has no body.onChain property",
					code: "missing_onchain",
				},
			]),
		};
	}

	const decodeResult = decodeConwayTx(txCbor);
	if (!decodeResult.success) return decodeResult;
	const decoded = decodeResult.data;

	const selectorResult = pickSelector(onChain, decoded, options?.selector);
	if (!selectorResult.success) return selectorResult;
	const { selectorUsed, candidate } = selectorResult.data;

	const cmp = compareOnChain(onChain, candidate, {
		stripSelfAnchor: options?.stripSelfAnchor,
	});
	if (!cmp.success) return cmp;

	if (cmp.data.equal) {
		return { success: true, data: { matched: true, selectorUsed } };
	}
	return {
		success: true,
		data: {
			matched: false,
			differences: cmp.data.differences,
			selectorUsed,
		},
	};
}

export interface VerifyAgainstEnvelopeOptions
	extends CompareOptions,
		DecodeGovEnvelopeOptions {}

/**
 * Verify a metadata document's `body.onChain` against a *bare* governance
 * artifact — a cardano-cli TextEnvelope (`.action` / `.vote` / `.cert` file
 * content, object or JSON string) or its raw CBOR — without needing the
 * full transaction. Decodes via `decodeGovEnvelope` and delegates to
 * `compareOnChain`.
 *
 * Returns:
 * - `{ matched: true, kind, anchors }` on a successful match,
 * - `{ matched: false, kind, anchors, differences }` when the structures
 *   diverge,
 * - or a top-level error (`success: false`) for missing `body.onChain` or
 *   an undecodable envelope.
 *
 * `anchors` are the metadata anchors CIP-0169 omits from `body.onChain`;
 * check their `data_hash` against the metadata file's blake2b-256 hash to
 * complete verification.
 */
export function verifyAgainstEnvelope(
	metadata: unknown,
	envelope: GovEnvelopeInput,
	options?: VerifyAgainstEnvelopeOptions,
): Result<VerifyAgainstEnvelopeResult, GovernanceMetadataError> {
	const onChain = extractOnChain(metadata);
	if (!onChain) {
		return {
			success: false,
			error: new ValidationError([
				{
					path: "body.onChain",
					message: "metadata document has no body.onChain property",
					code: "missing_onchain",
				},
			]),
		};
	}

	const decodeResult = decodeGovEnvelope(envelope, { kind: options?.kind });
	if (!decodeResult.success) return decodeResult;
	const { kind, onChain: candidate, anchors } = decodeResult.data;

	const cmp = compareOnChain(onChain, candidate, {
		stripSelfAnchor: options?.stripSelfAnchor,
	});
	if (!cmp.success) return cmp;

	if (cmp.data.equal) {
		return { success: true, data: { matched: true, kind, anchors } };
	}
	return {
		success: true,
		data: {
			matched: false,
			kind,
			anchors,
			differences: cmp.data.differences,
		},
	};
}

function extractOnChain(metadata: unknown): OnChain | null {
	if (!isObject(metadata)) return null;
	const body = (metadata as Record<string, unknown>).body;
	if (!isObject(body)) return null;
	const onChain = (body as Record<string, unknown>).onChain;
	if (onChain === undefined) return null;
	return onChain as OnChain;
}

interface PickedCandidate {
	selectorUsed: Selector;
	candidate: unknown;
}

function pickSelector(
	onChain: OnChain,
	decoded: ReturnType<typeof decodeConwayTx> extends Result<infer T, infer _E>
		? T
		: never,
	explicit: Selector | undefined,
): Result<PickedCandidate, GovernanceMetadataError> {
	const inferred: Selector["kind"] | null = inferKind(onChain);
	const kind = explicit?.kind ?? inferred;

	if (!kind) {
		return {
			success: false,
			error: new GovernanceMetadataError(
				ErrorCode.ONCHAIN_SELECTOR_AMBIGUOUS,
				"Could not infer selector kind from body.onChain — pass an explicit selector.",
			),
		};
	}

	if (kind === "votingProcedures") {
		if (!decoded.votingProcedures) {
			return notFound("transaction has no voting_procedures map");
		}
		return ok(
			{ kind: "votingProcedures" },
			decoded.votingProcedures as VotingProceduresNoAnchor,
		);
	}

	if (kind === "proposalProcedure") {
		const list = decoded.proposalProcedures;
		if (list.length === 0) {
			return notFound("transaction has no proposal procedures");
		}
		const idx = explicit && "index" in explicit ? explicit.index : undefined;
		if (idx === undefined && list.length > 1) {
			return ambiguous(
				`transaction has ${list.length} proposal procedures — pass selector.index`,
			);
		}
		const i = idx ?? 0;
		const candidate = list[i];
		if (!candidate) return notFound(`proposal procedure index ${i} not found`);
		return ok({ kind: "proposalProcedure", index: i }, candidate);
	}

	// certificate
	const list = decoded.certificates;
	if (list.length === 0) {
		return notFound(
			"transaction has no register_drep / update_drep / resign_committee_cold certificate",
		);
	}
	const idx = explicit && "index" in explicit ? explicit.index : undefined;
	if (idx === undefined && list.length > 1) {
		return ambiguous(
			`transaction has ${list.length} CIP-0169-bound certificates — pass selector.index`,
		);
	}
	const i = idx ?? 0;
	const candidate = list[i];
	if (!candidate) return notFound(`certificate index ${i} not found`);
	return ok({ kind: "certificate", index: i }, candidate);
}

function inferKind(onChain: unknown): Selector["kind"] | null {
	if (Array.isArray(onChain)) return "votingProcedures";
	if (!isObject(onChain)) return null;
	const obj = onChain as Record<string, unknown>;
	if (typeof obj.tag === "string" && CERT_TAGS.has(obj.tag))
		return "certificate";
	if ("gov_action" in obj && "deposit" in obj && "reward_account" in obj) {
		return "proposalProcedure";
	}
	return null;
}

const CERT_TAGS = new Set<string>([
	"register_drep",
	"update_drep",
	"resign_committee_cold",
]);

function ok(
	selectorUsed: Selector,
	candidate:
		| ProposalProcedureNoAnchor
		| CertNoAnchor
		| VotingProceduresNoAnchor,
): Result<PickedCandidate, GovernanceMetadataError> {
	return { success: true, data: { selectorUsed, candidate } };
}

function notFound(
	message: string,
): Result<PickedCandidate, GovernanceMetadataError> {
	return {
		success: false,
		error: new GovernanceMetadataError(
			ErrorCode.ONCHAIN_SELECTOR_NOT_FOUND,
			message,
		),
	};
}

function ambiguous(
	message: string,
): Result<PickedCandidate, GovernanceMetadataError> {
	return {
		success: false,
		error: new GovernanceMetadataError(
			ErrorCode.ONCHAIN_SELECTOR_AMBIGUOUS,
			message,
		),
	};
}

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Many on-chain numeric quantities (uint protocol params, epochs, indices) may
 * be serialized as a JSON number on one side and a decimal string on the other
 * — CIP-116 admits both spellings for metadata authors, while the CSL decode
 * yields numbers. Reconcile only the mixed number/string case; string/string
 * and number/number are left to exact comparison so two distinct large
 * integers can never round to a false match.
 */
function numericEqual(a: unknown, b: unknown): boolean {
	const aIsNum = typeof a === "number";
	const bIsNum = typeof b === "number";
	if (aIsNum === bIsNum) return false;
	const num = (aIsNum ? a : b) as number;
	const str = aIsNum ? b : a;
	if (typeof str !== "string" || str.trim() === "") return false;
	return Number.isFinite(num) && Number(str) === num;
}

function diff(
	a: unknown,
	b: unknown,
	path: string,
	out: OnChainDifference[],
): void {
	if (a === b) return;
	if (numericEqual(a, b)) return;
	if (typeof a !== typeof b) {
		out.push({ path, metadataValue: a, actionValue: b });
		return;
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) {
			out.push({ path, metadataValue: a, actionValue: b });
			return;
		}
		for (let i = 0; i < a.length; i++) {
			diff(a[i], b[i], joinPath(path, `[${i}]`), out);
		}
		return;
	}
	if (isObject(a) && isObject(b)) {
		const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
		for (const key of keys) {
			diff(a[key], b[key], joinPath(path, key), out);
		}
		return;
	}
	if (typeof a === "string" && typeof b === "string") {
		if (a === b) return;
		out.push({ path, metadataValue: a, actionValue: b });
		return;
	}
	if (typeof a === "number" && typeof b === "number") {
		if (a === b) return;
		out.push({ path, metadataValue: a, actionValue: b });
		return;
	}
	out.push({ path, metadataValue: a, actionValue: b });
}

function joinPath(base: string, leaf: string): string {
	if (!base) return leaf.startsWith("[") ? leaf : leaf;
	if (leaf.startsWith("[")) return base + leaf;
	return `${base}.${leaf}`;
}
