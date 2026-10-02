---
"@adasouls/mcp": minor
---

- Fix: tool results no longer fail validation in MCP clients that check output schemas. `adasouls_execute`, `adasouls_check_policy` and `adasouls_get_history` returned fields the closed schemas didn't list, so a validating client rejected them with "must NOT have additional properties". Output schemas now name the fields a client can rely on and accept any others.
- Add `adasouls_test_connection(agentId, runtime)`: the connection test for connecting an agent. Requires `@adasouls/sdk` 0.3.0.
