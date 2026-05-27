"use client";

import { useEffect, useRef, useState } from "react";

export type DropdownItem = {
  href: string;
  label: string;
  desc?: string;
  external?: boolean;
};

export function NavDropdown({
  label,
  items,
}: {
  label: string;
  items: DropdownItem[];
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className={`nav-dd ${open ? "open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="nav-dd-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <span className="nav-dd-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="nav-dd-panel" role="menu">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              role="menuitem"
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noreferrer" : undefined}
              className="nav-dd-item"
              onClick={() => setOpen(false)}
            >
              <span className="nav-dd-label">{item.label}</span>
              {item.desc ? (
                <span className="nav-dd-desc">{item.desc}</span>
              ) : null}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
