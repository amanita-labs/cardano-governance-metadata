import { useState } from "react";
import { ValidateTab } from "./tabs/ValidateTab";
import { GenerateTab } from "./tabs/GenerateTab";
import { OnChainTab } from "./tabs/OnChainTab";
import { ToolboxTab } from "./tabs/ToolboxTab";

const TABS = [
  { id: "validate", label: "Validate", el: <ValidateTab /> },
  { id: "generate", label: "Generate", el: <GenerateTab /> },
  { id: "onchain", label: "On-Chain · CIP-169", el: <OnChainTab /> },
  { id: "toolbox", label: "Toolbox", el: <ToolboxTab /> },
] as const;

export function App() {
  const [active, setActive] = useState<string>("validate");

  return (
    <div className="shell">
      <header className="masthead reveal reveal-1">
        <p className="eyebrow">@amanita-labs/cardano-governance-metadata</p>
        <h1>
          Governance Metadata <em>Instrument</em>
        </h1>
        <p className="lede">
          Validate existing metadata and generate new metadata for Cardano
          governance — fetch, detect, parse, schema-validate, hash, and verify
          author signatures, plus build CIP-169 on-chain effects and check them
          against a real Conway transaction. Everything runs in your browser,
          offline.
        </p>
        <div className="standards">
          {["CIP-100", "CIP-108", "CIP-119", "CIP-136", "CIP-169"].map((s) => (
            <span className="chip" key={s}>
              {s}
            </span>
          ))}
        </div>
      </header>

      <nav className="tabbar reveal reveal-2" role="tablist">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            className="tab"
            onClick={() => setActive(t.id)}
          >
            <span className="idx">{String(i + 1).padStart(2, "0")}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="reveal reveal-3" key={active}>
        {TABS.find((t) => t.id === active)?.el}
      </main>

      <footer className="footer">
        <span>
          A live demo of the public API surface — no metadata leaves your
          browser.
        </span>
        <span className="muted">
          CIP-169: On-Chain Effects · Intersect MBO
        </span>
      </footer>
    </div>
  );
}
