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
      // Older Safari / non-secure context: fall back to a hidden textarea
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
        <button
          type="button"
          className={`code-tabs-copy${copied ? " copied" : ""}`}
          onClick={copy}
          aria-label="Copy example to clipboard"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="endpoint-example">{examples[active]}</pre>
    </div>
  );
}
