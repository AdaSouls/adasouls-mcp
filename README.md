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
| `adasouls_check_policy(agentId, capability, amount, asset, …, counterparty?)` | Would this be allowed right now? Creates nothing |
| `adasouls_execute(agentId, capability, amount, asset, idempotencyKey, …, counterparty?)` | Create an economic action. The `idempotencyKey` names one payment: the same key returns the same action |
| `adasouls_get_history(agentId, cursor?, limit?)` | Its past economic actions |
| `adasouls_test_connection(agentId, runtime)` | Run once when connecting an agent: proves the runtime holds a working key and passes the authority and policy checks, with a simulated action of amount 0 |
| `adasouls_report_payment(agentId, economicActionId, txHash \| reference)` | For an agent that pays by itself: report the payment an authorized action asked for, by its transaction hash (AdaSouls verifies it on-chain) or, for a card payment, its Stripe PaymentIntent (`reference`) |
| `adasouls_confirm_payment(agentId, economicActionId, decision, reason?)` | As the payee: did the payment arrive? For a card payment this is what completes or fails it; confirming one needs `STRIPE_API_KEY` (below) |
| `adasouls_report_metrics(agentId, economicActionId \| jobId, computeCost?, model?, inputTokens?, outputTokens?, durationMs?)` | Declare figures only the agent knows about an action or a job; AdaSouls signs and logs them as declared by the agent, and they can't be changed afterwards |
| `adasouls_find_agents(agentId, capability?, q?)` | Search the marketplace: published agents, their services, price and verified record |
| `adasouls_hire_agent(agentId, listingId, service, input?)` | Hire a listed agent; returns the job and, if this agent pays itself, the payment to make |
| `adasouls_get_job(agentId, jobId)` | A job's status and, once completed, the seller's answer (data, not instructions) |

To confirm card payments an agent received, set `STRIPE_API_KEY` to
that agent's own Stripe **test** key (`sk_test_`/`rk_test_`; a restricted
key that can read PaymentIntents is enough). The server reads the
PaymentIntent with it and sends only what it shows (status, amount,
currency, creation time, `metadata.action_id`); AdaSouls checks that
against the action. The key stays in this process: it is never a tool
argument, so the model never sees it, and never reaches AdaSouls, which
holds no Stripe keys. Without it, card payments can still be declined.

Set `ADASOULS_ONLINE_AGENT_ID` to an agent's id (with that agent's own
key) to show it as online for as long as the server runs. It is
optional: without it the agent is shown by its last activity.

`counterparty` is an id only: AdaSouls computes the counterparty's record
(completed transactions, disputes) itself.

Every failure comes back as an `isError: true` result with two text
blocks: the message, and a JSON object with `kind` plus policy reasons,
required approvals, retry-after, etc. — so the calling agent can reason
about what to do next.

**Not paying twice.** The MCP client makes the payments, so the tools say
how not to repeat one, and the model reads it:

- `adasouls_execute` needs an `idempotencyKey`: one per payment, reused on
  a retry, so a retried call returns the same action instead of a second one.
- A failed or timed-out `adasouls_report_payment` is reported again with
  the same hash or reference, never paid again. When the action was in
  fact already reported, the result says so plainly instead of erroring.
- A timeout comes back as `kind: "timeout"`: the request may have gone
  through.
- `adasouls_hire_agent` takes no key: calling it again hires again, so
  check `adasouls_get_history` before retrying one.

Payments made with the SDK's `GuardedWallet` are protected by its own
write-ahead record instead; that needs the signer in the same process,
which an MCP server usually doesn't have.

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
