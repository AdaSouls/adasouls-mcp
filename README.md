# @adasouls/mcp

AdaSouls's MCP tool surface for MCP-compatible AI agent runtimes. A thin
adapter over `@adasouls/sdk` — zero independent policy, authorization,
or execution logic (ADR-009 in `alma`). See
`docs/repositories/adasouls-mcp/REPOSITORY.md` for the full design.

## Tools

Mirrors `docs/06-api-contracts.md`'s MCP tool surface one-for-one:

| Tool | Maps to |
|---|---|
| `adasouls_get_identity(agentId)` | `agent.identity()` |
| `adasouls_get_reputation(agentId)` | `agent.reputation()` |
| `adasouls_get_authority(agentId)` | `agent.authority()` |
| `adasouls_check_policy(agentId, capability, ...)` | `agent.checkPolicy()` |
| `adasouls_execute(agentId, capability, ...)` | `agent.execute()` |
| `adasouls_get_history(agentId, cursor?, limit?)` | `agent.history()` |

Every failure maps to a structured `isError: true` result carrying enough
detail (`structuredContent.kind`, plus policy reasons / approval
requirements / retry-after / etc.) for the calling agent to reason about
what to do next — never a generic failure. See `src/errors.ts`.

## Usage (as an MCP client config)

```json
{
  "mcpServers": {
    "adasouls": {
      "command": "npx",
      "args": ["-y", "@adasouls/mcp"],
      "env": { "ADASOULS_API_KEY": "ak_..." }
    }
  }
}
```

Local/stdio mode only in this pass — no hosted server mode yet (deferred
per `REPOSITORY.md`'s open question, until a customer actually needs one).

## Local development

```bash
npm install
cp .env.example .env   # ADASOULS_API_KEY, ADASOULS_API_URL
npm run dev             # stdio server
```

## Testing

```bash
npm test
```

Runs the mocked tool-level suite by default (`test/tools.test.ts` —
fake `@adasouls/sdk`, `InMemoryTransport`, real MCP wire format). To also
run the real end-to-end suite (`test/treasury-agent-via-mcp.test.ts`,
Phase 8's actual exit criterion — "the Treasury Agent demo also runs via
an MCP client") against a locally running `adasouls-api`:

```bash
# in adasouls-api: podman-compose up -d, npm run dev, then:
cd adasouls-api && npm run create-treasury-agent-test-fixture
# copy the printed export lines, then in this repo:
ADASOULS_API_URL="http://localhost:<port>/v1" \
ADASOULS_TEST_API_KEY="ak_..." \
ADASOULS_TEST_AGENT_ID="alma:main:agent:..." \
npm test
```

## Known gaps

- `@adasouls/sdk` isn't published yet — depends on it via a local
  sibling-checkout `file:` path, same interim state as
  `reference-agents/treasury-agent`. Switch once it's published.
- No hosted server mode (SSE/streamable HTTP) — stdio only, per
  `REPOSITORY.md`'s "leaning toward deferring hosted mode until
  requested."
- Marketplace tools (`adasouls_find_agents`, `adasouls_hire_agent`) are
  Phase 13+ scope, not built here.
