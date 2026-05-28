import { StatusBadge } from "./StatusBadge";
import { NavDropdown, type DropdownItem } from "./NavDropdown";

const EXPLORE_ITEMS: DropdownItem[] = [
  { href: "/explore", label: "explore home", desc: "live blocks + dashboard index" },
  { href: "/explore/sql", label: "sql playground", desc: "Dune-style SELECT against the indexed tables" },
  { href: "/explore/uniswap-v3", label: "uniswap v3", desc: "decoded swap / mint / burn per pool" },
  { href: "/explore/horizon", label: "graph horizon", desc: "stake, delegation, slashing timeline" },
  { href: "/explore/whales", label: "whale transfers", desc: "live big-Transfer ticker" },
  { href: "/explore/gas", label: "gas & throughput", desc: "base-fee + per-block gas chart" },
  { href: "/explore/token", label: "token volume", desc: "bucketed transfer volume for any ERC-20" },
  { href: "/explore/address", label: "address profile", desc: "tx + transfers + interactions for a wallet" },
  { href: "/explore/contract", label: "contract activity", desc: "log-count time-series" },
  { href: "/explore/lookup", label: "block / tx / events", desc: "ad-hoc primitives forms" },
  { href: "/explore/signatures", label: "event signatures", desc: "well-known topic0 reference" },
];

const DOCS_ITEMS: DropdownItem[] = [
  { href: "/docs", label: "API reference", desc: "browsable OpenAPI 3.1 (Scalar)" },
  { href: "/openapi.yaml", label: "openapi.yaml", desc: "raw spec — feed to your client generator" },
  { href: "/#endpoints", label: "endpoint catalog", desc: "list with code samples (curl / js / py / rust)" },
  { href: "/v1/datasets", label: "datasets surface", desc: "JSON description of every endpoint family" },
  { href: "/v1/status", label: "status JSON", desc: "tip block, indexed count, history depth" },
  {
    href: "https://github.com/lodestar-team/camp#readme",
    label: "README",
    desc: "project overview on GitHub",
    external: true,
  },
];

const LEARN_ITEMS: DropdownItem[] = [
  {
    href: "https://www.lodestar-dashboard.com/blog/camp-free-amp-api-arbitrum",
    label: "intro to camp",
    desc: "what it is, why we built it, how to use it",
    external: true,
  },
  {
    href: "https://www.lodestar-dashboard.com/blog/camp-deep-dive",
    label: "camp deep dive",
    desc: "architecture, indexer internals, the Flight shim",
    external: true,
  },
];

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
          <NavDropdown label="explore" items={EXPLORE_ITEMS} />
          <NavDropdown label="docs" items={DOCS_ITEMS} />
          <NavDropdown label="learn" items={LEARN_ITEMS} />
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
