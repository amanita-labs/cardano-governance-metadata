export enum ErrorCode {
  // Fetch
  FETCH_FAILED = "FETCH_FAILED",
  FETCH_TIMEOUT = "FETCH_TIMEOUT",
  INVALID_URI = "INVALID_URI",
  UNSUPPORTED_PROTOCOL = "UNSUPPORTED_PROTOCOL",

  // Parse
  INVALID_JSON = "INVALID_JSON",
  INVALID_JSONLD = "INVALID_JSONLD",
  MISSING_CONTEXT = "MISSING_CONTEXT",

  // Validation
  SCHEMA_VALIDATION_FAILED = "SCHEMA_VALIDATION_FAILED",
  FIELD_TOO_LONG = "FIELD_TOO_LONG",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
  INVALID_HASH_ALGORITHM = "INVALID_HASH_ALGORITHM",

  // Verification
  ANCHOR_HASH_MISMATCH = "ANCHOR_HASH_MISMATCH",
  CANONICALIZATION_FAILED = "CANONICALIZATION_FAILED",
  SIGNATURE_INVALID = "SIGNATURE_INVALID",
  MISSING_WITNESS = "MISSING_WITNESS",
  ONCHAIN_MISMATCH = "ONCHAIN_MISMATCH",

  // CIP-169 / on-chain decode
  CSL_NOT_INITIALIZED = "CSL_NOT_INITIALIZED",
  TX_DECODE_FAILED = "TX_DECODE_FAILED",
  ONCHAIN_SELECTOR_AMBIGUOUS = "ONCHAIN_SELECTOR_AMBIGUOUS",
  ONCHAIN_SELECTOR_NOT_FOUND = "ONCHAIN_SELECTOR_NOT_FOUND",

  // Generic
  UNKNOWN = "UNKNOWN",
}

export interface ValidationIssue {
  path: string;
  message: string;
  code: string;
}

export class GovernanceMetadataError extends Error {
  readonly code: ErrorCode;
  override readonly cause?: unknown;

  constructor(code: ErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "GovernanceMetadataError";
    this.code = code;
    this.cause = cause;
  }
}

export class FetchError extends GovernanceMetadataError {
  constructor(code: ErrorCode, message: string, cause?: unknown) {
    super(code, message, cause);
    this.name = "FetchError";
  }
}

export class ParseError extends GovernanceMetadataError {
  constructor(code: ErrorCode, message: string, cause?: unknown) {
    super(code, message, cause);
    this.name = "ParseError";
  }
}

export class ValidationError extends GovernanceMetadataError {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[], cause?: unknown) {
    const message = issues
      .map((i) => `${i.path}: ${i.message}`)
      .join("; ");
    super(ErrorCode.SCHEMA_VALIDATION_FAILED, message, cause);
    this.name = "ValidationError";
    this.issues = issues;
  }

  static fromZodError(zodError: {
    issues: Array<{
      path: (string | number)[];
      message: string;
      code: string;
    }>;
  }): ValidationError {
    const issues = zodError.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
      code: i.code,
    }));
    return new ValidationError(issues, zodError);
  }
}

export class VerificationError extends GovernanceMetadataError {
  constructor(code: ErrorCode, message: string, cause?: unknown) {
    super(code, message, cause);
    this.name = "VerificationError";
  }
}
