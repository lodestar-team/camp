"use client";

import { useEffect, useRef, useState } from "react";

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
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  async function copy() {
    const text = examples[active] ?? "";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  }

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
      <div className="code-tabs-box">
        <pre className="endpoint-example">{examples[active]}</pre>
        <button
          type="button"
          className={`code-tabs-copy${copied ? " copied" : ""}`}
          onClick={copy}
          aria-label="Copy example to clipboard"
        >
          {copied ? (
            <CheckIcon />
          ) : (
            <CopyIcon />
          )}
        </button>
      </div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="4.5" y="4.5" width="9" height="10" rx="1.5"
        stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 11V2.5a1 1 0 0 1 1-1H11"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5 6.5 12 13 4.5"
        stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
