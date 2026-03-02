/**
 * Error handling patterns.
 *
 * All functions return Result<T, E> instead of throwing.
 * Errors include a machine-readable ErrorCode for programmatic matching.
 */
import {
  resolve,
  cip108,
  fetchMetadata,
  ErrorCode,
  type GovernanceMetadataError,
} from "cardano-governance-metadata";

// --- Handling parse/validation errors ---

const parseResult = cip108.parse("not valid json");

if (!parseResult.success) {
  const err = parseResult.error;

  switch (err.code) {
    case ErrorCode.INVALID_JSON:
      console.error("Malformed JSON:", err.message);
      break;
    case ErrorCode.SCHEMA_VALIDATION_FAILED:
      console.error("Schema validation failed:");
      if ("issues" in err) {
        for (const issue of err.issues) {
          console.error(`  ${issue.path}: ${issue.message}`);
        }
      }
      break;
  }
}

// --- Handling validation errors with field details ---

const validateResult = cip108.validate({
  "@context": {},
  hashAlgorithm: "blake2b-256",
  body: {
    title: "A".repeat(81), // too long
    // missing abstract, motivation, rationale
  },
});

if (!validateResult.success) {
  console.error(`${validateResult.error.issues.length} issue(s):`);
  for (const issue of validateResult.error.issues) {
    console.error(`  [${issue.code}] ${issue.path}: ${issue.message}`);
  }
  // Output:
  //   [too_big] body.title: String must contain at most 80 character(s)
  //   [invalid_type] body.abstract: Required
  //   [invalid_type] body.motivation: Required
  //   [invalid_type] body.rationale: Required
}

// --- Handling fetch errors ---

const fetchResult = await fetchMetadata("https://nonexistent.example.com/metadata.jsonld");

if (!fetchResult.success) {
  switch (fetchResult.error.code) {
    case ErrorCode.FETCH_FAILED:
      console.error("HTTP error:", fetchResult.error.message);
      break;
    case ErrorCode.FETCH_TIMEOUT:
      console.error("Request timed out");
      break;
    case ErrorCode.UNSUPPORTED_PROTOCOL:
      console.error("Unsupported URI scheme:", fetchResult.error.message);
      break;
  }
}

// --- Handling resolve errors ---

const resolveResult = await resolve("https://example.com/metadata.jsonld");

if (!resolveResult.success) {
  const err = resolveResult.error;

  // All errors extend GovernanceMetadataError
  console.error(`[${err.code}] ${err.name}: ${err.message}`);

  // Check error type by code
  if (err.code === ErrorCode.INVALID_JSONLD) {
    console.error("Document does not match any known CIP standard");
  }

  // Original cause is preserved
  if (err.cause) {
    console.error("Caused by:", err.cause);
  }
}

// --- Generic error handler ---

function handleError(err: GovernanceMetadataError): void {
  console.error(`[${err.code}] ${err.message}`);

  if (err.code === ErrorCode.SCHEMA_VALIDATION_FAILED && "issues" in err) {
    const issues = (err as { issues: Array<{ path: string; message: string }> }).issues;
    for (const issue of issues) {
      console.error(`  ${issue.path}: ${issue.message}`);
    }
  }
}
