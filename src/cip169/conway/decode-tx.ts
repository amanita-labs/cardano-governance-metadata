import {
	ErrorCode,
	GovernanceMetadataError,
	ParseError,
} from "../../core/errors.js";
import type { Result } from "../../core/types.js";
import type {
	CertNoAnchor,
	DecodedConwayTx,
	ProposalProcedureNoAnchor,
} from "../types.js";
import {
	encodeCredential,
	encodeProposalProcedureNoAnchor,
	encodeVotingProceduresNoAnchor,
} from "./cip116-encode.js";
import { requireCsl } from "./csl-loader.js";

const CERT_KIND_COMMITTEE_COLD_RESIGN = 8;
const CERT_KIND_DREP_REGISTRATION = 10;
const CERT_KIND_DREP_UPDATE = 11;

/**
 * Decode a Conway-era transaction CBOR (`Uint8Array` or hex string) into the
 * three CIP-169-bound fields: `proposalProcedures`, `certificates` (limited
 * to register_drep / update_drep / resign_committee_cold), and
 * `votingProcedures`.
 *
 * Items the encoder cannot represent are recorded in `data.skipped` rather
 * than failing the whole call — caller decides how strict to be.
 *
 * Requires `cip169.setCardanoSerializationLib(CSL)` to have been called
 * first; otherwise returns `CSL_NOT_INITIALIZED`.
 */
export function decodeConwayTx(
	txCbor: Uint8Array | string,
): Result<DecodedConwayTx, GovernanceMetadataError> {
	let csl: ReturnType<typeof requireCsl>;
	try {
		csl = requireCsl();
	} catch (err) {
		if (err instanceof GovernanceMetadataError) {
			return { success: false, error: err };
		}
		throw err;
	}

	let tx: ReturnType<typeof csl.Transaction.from_bytes>;
	try {
		tx =
			typeof txCbor === "string"
				? csl.Transaction.from_hex(txCbor)
				: csl.Transaction.from_bytes(txCbor);
	} catch (err) {
		return {
			success: false,
			error: new ParseError(
				ErrorCode.TX_DECODE_FAILED,
				`Failed to decode Conway transaction: ${err instanceof Error ? err.message : String(err)}`,
				err,
			),
		};
	}

	const skipped: DecodedConwayTx["skipped"] = [];
	const proposalProcedures: ProposalProcedureNoAnchor[] = [];
	const certificates: CertNoAnchor[] = [];
	let votingProcedures: DecodedConwayTx["votingProcedures"] = null;

	// Every CSL handle we materialize gets pushed here so the finally block
	// frees them all, even if encoding throws. WASM allocations are not
	// garbage-collected — failing to free them leaks heap per call.
	const handles: Array<{ free?: () => void }> = [];
	const track = <T extends { free?: () => void }>(h: T): T => {
		handles.push(h);
		return h;
	};

	try {
		const body = track(tx.body());

		const proposals = track(body.voting_proposals());
		if (proposals) {
			const proposalsLen = proposals.len();
			for (let i = 0; i < proposalsLen; i++) {
				const proposal = track(proposals.get(i));
				try {
					proposalProcedures.push(encodeProposalProcedureNoAnchor(proposal));
				} catch (err) {
					skipped.push({
						kind: "proposal",
						reason: `proposal[${i}]: ${err instanceof Error ? err.message : String(err)}`,
					});
				}
			}
		}

		const procs = track(body.voting_procedures());
		if (procs) {
			try {
				votingProcedures = encodeVotingProceduresNoAnchor(procs);
			} catch (err) {
				return {
					success: false,
					error: new ParseError(
						ErrorCode.TX_DECODE_FAILED,
						`Failed to encode voting procedures: ${err instanceof Error ? err.message : String(err)}`,
						err,
					),
				};
			}
		}

		const certs = track(body.certs());
		if (certs) {
			const certsLen = certs.len();
			for (let i = 0; i < certsLen; i++) {
				const cert = track(certs.get(i));
				try {
					const kind = cert.kind();
					switch (kind) {
						case CERT_KIND_DREP_REGISTRATION: {
							const c = track(cert.as_drep_registration());
							if (!c) break;
							const cred = track(c.voting_credential());
							const coin = track(c.coin());
							certificates.push({
								tag: "register_drep",
								drep_credential: encodeCredential(cred),
								coin: coin.to_str(),
							});
							break;
						}
						case CERT_KIND_DREP_UPDATE: {
							const c = track(cert.as_drep_update());
							if (!c) break;
							const cred = track(c.voting_credential());
							certificates.push({
								tag: "update_drep",
								drep_credential: encodeCredential(cred),
							});
							break;
						}
						case CERT_KIND_COMMITTEE_COLD_RESIGN: {
							const c = track(cert.as_committee_cold_resign());
							if (!c) break;
							const cred = track(c.committee_cold_credential());
							certificates.push({
								tag: "resign_committee_cold",
								committee_cold_credential: encodeCredential(cred),
							});
							break;
						}
						default:
							skipped.push({
								kind: "certificate",
								reason: `certificate[${i}] kind=${kind} is not bound by CIP-0169`,
							});
					}
				} catch (err) {
					skipped.push({
						kind: "certificate",
						reason: `certificate[${i}]: ${err instanceof Error ? err.message : String(err)}`,
					});
				}
			}
		}
	} finally {
		// Free in reverse order — inner handles before the outer ones they
		// were derived from. Each free is wrapped because some CSL builds
		// throw on double-free / null handles.
		for (let i = handles.length - 1; i >= 0; i--) {
			try {
				handles[i].free?.();
			} catch {
				// best-effort cleanup
			}
		}
		try {
			tx.free?.();
		} catch {
			// best-effort cleanup
		}
	}

	return {
		success: true,
		data: { proposalProcedures, certificates, votingProcedures, skipped },
	};
}
