"use client";

import { useState } from "react";

type Lang = "curl" | "js" | "py" | "rs";
type Examples = Partial<Record<Lang, string>>;

const LABELS: Record<Lang, string> = {
  curl: "curl",
  js: "javascript",
  py: "python",
  rs: "rust",
};

export function CodeTabs({ examples }: { examples: Examples }) {
  const langs = (Object.keys(LABELS) as Lang[]).filter((l) => examples[l]);
  const [active, setActive] = useState<Lang>(langs[0] ?? "curl");

  return (
    <div className="code-tabs">
      <div className="code-tabs-strip" role="tablist">
        {langs.map((lang) => (
          <button
            key={lang}
            type="button"
            role="tab"
            aria-selected={active === lang}
            className={`code-tabs-tab${active === lang ? " active" : ""}`}
            onClick={() => setActive(lang)}
          >
            {LABELS[lang]}
          </button>
        ))}
      </div>
      <pre className="endpoint-example">{examples[active]}</pre>
    </div>
  );
}
