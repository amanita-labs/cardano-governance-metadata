import type { Result } from "../../core/types.js";
import {
  ErrorCode,
  GovernanceMetadataError,
  ParseError,
} from "../../core/errors.js";
import type {
  CertNoAnchor,
  DecodedConwayTx,
  ProposalProcedureNoAnchor,
} from "../types.js";
import { requireCsl } from "./csl-loader.js";
import {
  encodeCredential,
  encodeProposalProcedureNoAnchor,
  encodeVotingProceduresNoAnchor,
} from "./cip116-encode.js";

const CERT_KIND_COMMITTEE_COLD_RESIGN = 8;
const CERT_KIND_DREP_REGISTRATION = 10;
const CERT_KIND_DREP_UPDATE = 11;

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
    tx = typeof txCbor === "string"
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

  try {
    const body = tx.body();

    const proposals = body.voting_proposals();
    if (proposals) {
      for (let i = 0; i < proposals.len(); i++) {
        const proposal = proposals.get(i);
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

    const procs = body.voting_procedures();
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

    const certs = body.certs();
    if (certs) {
      for (let i = 0; i < certs.len(); i++) {
        const cert = certs.get(i);
        const kind = cert.kind();
        switch (kind) {
          case CERT_KIND_DREP_REGISTRATION: {
            const c = cert.as_drep_registration();
            if (!c) break;
            certificates.push({
              tag: "register_drep",
              drep_credential: encodeCredential(c.voting_credential()),
              coin: c.coin().to_str(),
            });
            break;
          }
          case CERT_KIND_DREP_UPDATE: {
            const c = cert.as_drep_update();
            if (!c) break;
            certificates.push({
              tag: "update_drep",
              drep_credential: encodeCredential(c.voting_credential()),
            });
            break;
          }
          case CERT_KIND_COMMITTEE_COLD_RESIGN: {
            const c = cert.as_committee_cold_resign();
            if (!c) break;
            certificates.push({
              tag: "resign_committee_cold",
              committee_cold_credential: encodeCredential(
                c.committee_cold_credential(),
              ),
            });
            break;
          }
          default:
            skipped.push({
              kind: "certificate",
              reason: `certificate[${i}] kind=${kind} is not bound by CIP-0169`,
            });
        }
      }
    }
  } finally {
    tx.free?.();
  }

  return {
    success: true,
    data: { proposalProcedures, certificates, votingProcedures, skipped },
  };
}
