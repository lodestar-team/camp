export type DropdownItem = {
  href: string;
  label: string;
  desc?: string;
  external?: boolean;
};

// Pure CSS hover/focus-within dropdown. No JS state, no hydration, fully
// SSR'd. The .nav-dd-panel is shown when its parent is hovered or any
// descendant has focus, so it works for keyboard navigation too.
export function NavDropdown({
  label,
  items,
}: {
  label: string;
  items: DropdownItem[];
}) {
  return (
    <div className="nav-dd">
      <button
        type="button"
        className="nav-dd-trigger"
        aria-haspopup="menu"
      >
        {label}
        <span className="nav-dd-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      <div className="nav-dd-panel" role="menu">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            role="menuitem"
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noreferrer" : undefined}
            className="nav-dd-item"
          >
            <span className="nav-dd-label">{item.label}</span>
            {item.desc ? (
              <span className="nav-dd-desc">{item.desc}</span>
            ) : null}
          </a>
        ))}
      </div>
    </div>
  );
}
