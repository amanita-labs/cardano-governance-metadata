import { useState } from "react";

/** Read-only mono code block with a copy button and optional download. */
export function JsonView({
  title,
  text,
  download,
}: {
  title?: string;
  text: string;
  download?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard may be unavailable; ignore */
    }
  }

  function doDownload() {
    const blob = new Blob([text], { type: "application/ld+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = download ?? "metadata.jsonld";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="codeblock">
      <div className="cb-head">
        <span>{title ?? "output"}</span>
        <div className="row" style={{ gap: 6 }}>
          {download && (
            <button className="btn tiny ghost" onClick={doDownload}>
              Download
            </button>
          )}
          <button className="btn tiny ghost" onClick={copy}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>
      <pre>{text}</pre>
    </div>
  );
}
