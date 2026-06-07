import type { GovernanceMetadataError } from "../lib";

/**
 * Renders a library error: a `ValidationError` becomes a per-issue list
 * (path + message), any other `GovernanceMetadataError` shows its code +
 * message. Mirrors how a consumer would surface the `Result` error branch.
 *
 * Detection is structural (the error's `code` / `issues` fields) rather than
 * `instanceof` / enum values, so the demo bundles cleanly regardless of how
 * the library's tree-shaken `dist` re-exports its error runtime values.
 */
interface ValidationIssue {
  path: string;
  message: string;
  code?: string;
}

export function IssueList({ error }: { error: GovernanceMetadataError }) {
  const code = (error as { code?: string }).code ?? "UNKNOWN";
  const issues = (error as { issues?: ValidationIssue[] }).issues;

  if (Array.isArray(issues) && issues.length > 0) {
    return (
      <div className="stack" style={{ gap: 8 }}>
        <div className="row">
          <span className="errcode">{code}</span>
          <span className="muted" style={{ fontSize: 13 }}>
            {issues.length} issue{issues.length === 1 ? "" : "s"}
          </span>
        </div>
        {issues.map((issue, i) => (
          <div className="issue" key={i}>
            <span className="path">{issue.path || "(root)"}</span>
            <span className="msg">
              {issue.message}
              {issue.code ? (
                <span className="muted"> · {issue.code}</span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="issue">
      <span className="path">{code}</span>
      <span className="msg">{error.message}</span>
    </div>
  );
}
