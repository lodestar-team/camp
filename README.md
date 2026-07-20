# camp 🏕️ — retired

**camp and Amp have been retired.** The free Arbitrum One data API, the SQL
playground, the `/explore` dashboards, the MCP server, the self-built engine —
all stood down.

## Use nuthatch instead

Everything camp did is now done better by **nuthatch**:

### → https://nuthatch-indexer.com/

Point a nuthatch nest at any contract and it indexes the events straight into a
local SQL database — no shared node to babysit, no rate limits, no dependence on
someone else's uptime. If you came here for Arbitrum data, go there.

## What's left in this repo

Just the static landing page (`src/app/page.tsx`) that points visitors to
nuthatch. The old gateway — the entire `/v1` REST API, the dashboards, the
`src/lib` query layer, the MCP server — was removed in the teardown. It all
lives on in git history if you ever need to dig it up.

## License

MIT.
