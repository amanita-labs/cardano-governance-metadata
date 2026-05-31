import { parse as parseCip100 } from "./cip100/parse.js";
import { verify as verifyCip100 } from "./cip100/verify.js";
import { parse as parseCip108 } from "./cip108/parse.js";
import { parse as parseCip119 } from "./cip119/parse.js";
import { parse as parseCip136 } from "./cip136/parse.js";
import {
	ErrorCode,
	type GovernanceMetadataError,
	ParseError,
} from "./core/errors.js";
import { fetchMetadata } from "./core/fetcher.js";
import type {
	CipExtension,
	CipStandard,
	ExtraFieldInfo,
	ResolveOptions,
	ResolvedMetadata,
	Result,
} from "./core/types.js";
import { detectCipStandard } from "./detect.js";

const KNOWN_DOCUMENT_FIELDS = new Set([
	"@context",
	"@type",
	"@language",
	"hashAlgorithm",
	"authors",
	"body",
]);

const KNOWN_BODY_FIELDS: Record<CipStandard, Set<string>> = {
	"CIP-100": new Set(["references", "comment", "externalUpdates", "onChain"]),
	"CIP-108": new Set([
		"references",
		"comment",
		"externalUpdates",
		"onChain",
		"title",
		"abstract",
		"motivation",
		"rationale",
	]),
	"CIP-119": new Set([
		"references",
		"comment",
		"externalUpdates",
		"onChain",
		"givenName",
		"image",
		"objectives",
		"motivations",
		"qualifications",
		"paymentAddress",
		"doNotList",
	]),
	"CIP-136": new Set([
		"references",
		"comment",
		"externalUpdates",
		"onChain",
		"summary",
		"rationaleStatement",
		"precedentDiscussion",
		"counterargumentDiscussion",
		"conclusion",
		"internalVote",
	]),
};

function collectExtraFields(
	document: Record<string, unknown>,
	cipStandard: CipStandard,
): ExtraFieldInfo[] {
	const extras: ExtraFieldInfo[] = [];

	for (const key of Object.keys(document)) {
		if (!KNOWN_DOCUMENT_FIELDS.has(key)) {
			extras.push({ path: key, value: document[key] });
		}
	}

	const body = document.body;
	if (body && typeof body === "object") {
		const knownBodyFields = KNOWN_BODY_FIELDS[cipStandard];
		for (const key of Object.keys(body)) {
			if (!knownBodyFields.has(key)) {
				extras.push({
					path: `body.${key}`,
					value: (body as Record<string, unknown>)[key],
				});
			}
		}
	}

	return extras;
}

/**
 * Fetch metadata from a URI, detect which CIP standard it conforms to,
 * parse + validate against the matching schema, and optionally verify the
 * anchor hash and witness signatures.
 *
 * The returned `ResolvedMetadata` includes:
 * - `cipStandard` — one of "CIP-100" / "CIP-108" / "CIP-119" / "CIP-136"
 * - `extensions` — cross-cutting extensions detected (currently `["CIP-169"]`
 *   when the body has an `onChain` block)
 * - `document` — the parsed document with extra fields preserved
 * - `rawBytes` — the bytes the anchor hash is computed over
 * - `extraFields` — any fields not defined by the detected CIP, both at
 *   the envelope and the body level
 * - `verification` — anchor hash + per-witness signature results (omitted
 *   when `skipVerification: true`)
 *
 * @example
 * const r = await resolve("ipfs://QmExampleCid", {
 *   anchorHash: "7b7d4a28...",
 *   contextOptions: { policy: "bundled-only" },
 * });
 * if (r.success) {
 *   console.log(r.data.cipStandard);
 *   console.log(r.data.verification?.valid);
 * }
 */
export async function resolve(
	uri: string,
	options?: ResolveOptions,
): Promise<Result<ResolvedMetadata, GovernanceMetadataError>> {
	// 1. Fetch raw bytes
	const fetchResult = await fetchMetadata(uri, options?.fetchOptions);
	if (!fetchResult.success) return fetchResult;
	const rawBytes = fetchResult.data;

	// 2. Parse JSON
	let raw: Record<string, unknown>;
	try {
		raw = JSON.parse(new TextDecoder().decode(rawBytes));
	} catch (err) {
		return {
			success: false,
			error: new ParseError(
				ErrorCode.INVALID_JSON,
				`Invalid JSON: ${err}`,
				err,
			),
		};
	}

	// 3. Detect CIP standard
	const cipStandard = detectCipStandard(raw);
	if (!cipStandard) {
		return {
			success: false,
			error: new ParseError(
				ErrorCode.INVALID_JSONLD,
				"Could not detect CIP standard: document does not match any known CIP body shape",
			),
		};
	}

	// 4. Parse + validate with the correct CIP schema
	const parseResult = (() => {
		switch (cipStandard) {
			case "CIP-108":
				return parseCip108(raw);
			case "CIP-119":
				return parseCip119(raw);
			case "CIP-136":
				return parseCip136(raw);
			default:
				return parseCip100(raw);
		}
	})();

	if (!parseResult.success) return parseResult;

	// 5. Collect extra fields not defined by the detected CIP
	const extraFields = collectExtraFields(raw, cipStandard);

	// 6. Detect cross-cutting CIP extensions
	const extensions: CipExtension[] = [];
	const body = raw.body;
	if (
		body &&
		typeof body === "object" &&
		"onChain" in body &&
		(body as Record<string, unknown>).onChain !== undefined
	) {
		extensions.push("CIP-169");
	}

	// 7. Optionally verify (anchor hash + witness signatures)
	let verification: ResolvedMetadata["verification"];
	let verificationError: ResolvedMetadata["verificationError"];
	if (!options?.skipVerification) {
		const verifyResult = await verifyCip100(
			{ document: raw, rawBytes },
			{
				anchorHash: options?.anchorHash,
				fetchOptions: options?.fetchOptions,
				contextOptions: options?.contextOptions,
			},
		);
		if (verifyResult.success) {
			verification = verifyResult.data;
		} else {
			verificationError = {
				name: verifyResult.error.name,
				code: verifyResult.error.code,
				message: verifyResult.error.message,
			};
		}
	}

	return {
		success: true,
		data: {
			cipStandard,
			extensions,
			document: parseResult.data as unknown as Record<string, unknown>,
			rawBytes,
			extraFields,
			verification,
			verificationError,
		},
	};
}
