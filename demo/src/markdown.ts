/**
 * Parse a CIP-108 proposal Markdown document into form fields — a faithful
 * port of IntersectMBO's `governance-scripts/scripts/metadata-create.sh`
 * authoring format, so documents written for that tool import cleanly here.
 *
 * The script splits on H2 headings (`## Title`, `## Abstract`, `## Motivation`,
 * `## Rationale`, `## References`, `## Authors`), takes each section's body as
 * the lines between its heading and the next, and parses References from
 * Markdown link bullets (`* [label](url)`), all typed `Other`.
 */

export interface ParsedReference {
  type: "GovernanceMetadata" | "Other";
  label: string;
  uri: string;
  hashDigest: string;
}

export interface ParsedProposal {
  title: string;
  abstract: string;
  motivation: string;
  rationale: string;
  references: ParsedReference[];
}

const REF_BULLET = /^[*-]\s+\[([^\]]*)\]\(([^)]+)\)/;

/** Group a Markdown document's lines by their preceding `## Heading`. */
function sectionsByHeading(md: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let current: string | null = null;
  for (const line of md.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = heading[1].trim();
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (current) sections.get(current)?.push(line);
  }
  return sections;
}

function parseReferences(lines: string[]): ParsedReference[] {
  const out: ParsedReference[] = [];
  for (const line of lines) {
    const m = line.trim().match(REF_BULLET);
    if (m) out.push({ type: "Other", label: m[1].trim(), uri: m[2].trim(), hashDigest: "" });
  }
  return out;
}

export function parseProposalMarkdown(md: string): ParsedProposal {
  const sections = sectionsByHeading(md);
  const body = (name: string) => (sections.get(name) ?? []).join("\n").trim();
  return {
    title: body("Title"),
    abstract: body("Abstract"),
    motivation: body("Motivation"),
    rationale: body("Rationale"),
    references: parseReferences(sections.get("References") ?? []),
  };
}
