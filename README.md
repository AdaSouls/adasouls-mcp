# @adasouls/mcp

An [MCP](https://modelcontextprotocol.io) server for
[AdaSouls](https://github.com/AdaSouls): it lets any MCP-compatible AI agent
runtime check policy and execute economic actions (pay, …) through
AdaSouls, under the identity, delegations and policies of an
[ALMA](https://github.com/AdaSouls/alma) agent.

It is a thin adapter over [`@adasouls/sdk`](https://github.com/AdaSouls/adasouls-sdk-typescript):
no policy, authorization or execution logic of its own. MIT licensed.

> **No hosted API yet.** The SDK's default endpoint
> (`https://api.adasouls.io/v1`) is not live. Set `ADASOULS_API_URL` to
> your own `adasouls-api`.

## Use it from an MCP client

```json
{
  "mcpServers": {
    "adasouls": {
      "command": "npx",
      "args": ["-y", "@adasouls/mcp"],
      "env": {
        "ADASOULS_API_KEY": "ak_...",
        "ADASOULS_API_URL": "http://localhost:3000/v1"
      }
    }
  }
}
```

Use an **agent key** (minted for one agent in the AdaSouls console): it can
act as that agent only.

## Tools

| Tool | What it does |
|---|---|
| `adasouls_get_identity(agentId)` | The agent's ALMA identity |
| `adasouls_get_reputation(agentId)` | Its reputation evidence |
| `adasouls_get_authority(agentId)` | Its active delegations and applicable policies |
| `adasouls_check_policy(agentId, capability, …, counterparty?)` | Would this be allowed right now? Creates nothing |
| `adasouls_execute(agentId, capability, …, counterparty?)` | Create an economic action |
| `adasouls_get_history(agentId, cursor?, limit?)` | Its past economic actions |
| `adasouls_test_connection(agentId, runtime)` | Run once when connecting an agent: proves the runtime holds a working key and passes the authority and policy checks, with a simulated action of amount 0 |

`counterparty` is an id only: AdaSouls computes the counterparty's record
(completed transactions, disputes) itself.

Every failure comes back as a structured `isError: true` result —
`structuredContent.kind` plus policy reasons, required approvals,
retry-after, etc. — so the calling agent can reason about what to do next.

## Development

```bash
npm install
cp .env.example .env   # ADASOULS_API_KEY, ADASOULS_API_URL
npm run dev            # stdio server
npm test               # mocked tool-level suite (real MCP wire format)
```

To also run the end-to-end suite (`test/treasury-agent-via-mcp.test.ts`)
against a local `adasouls-api`: run its `create-treasury-agent-test-fixture`
script, then

```bash
ADASOULS_API_URL="http://localhost:3000/v1" \
ADASOULS_TEST_API_KEY="ak_..." \
ADASOULS_TEST_AGENT_ID="alma:main:agent:..." \
ADASOULS_TEST_VENDOR_ID="alma:main:agent:..." \
npm test
```

Releases use [changesets](https://github.com/changesets/changesets); merging
the "Version Packages" PR publishes to npm with provenance.

Code comments cite AdaSouls design documents (`REPOSITORY.md`, `ADR-NNN`)
that are not published yet; the tests are the precise specification.

## Not built yet

- A hosted server mode (SSE / streamable HTTP): stdio only for now.
- Marketplace tools (`adasouls_find_agents`, `adasouls_hire_agent`).

## Security

Please report vulnerabilities privately — see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
