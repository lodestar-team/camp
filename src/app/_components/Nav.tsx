import { StatusBadge } from "./StatusBadge";

export function Nav() {
  return (
    <header className="nav">
      <div className="container nav-inner">
        <a href="/" className="brand">
          <svg
            className="brand-mark"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 19 L12 5 L19 19 Z M9 16 H15"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          camp
        </a>
        <nav className="nav-links">
          <a href="/explore">explore</a>
          <a href="/docs">docs</a>
          <StatusBadge />
          <a
            href="https://github.com/lodestar-team/camp"
            target="_blank"
            rel="noreferrer"
          >
            github
          </a>
        </nav>
      </div>
    </header>
  );
}
