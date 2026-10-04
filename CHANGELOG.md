# @adasouls/mcp

## 0.4.0

### Minor Changes

- [#8](https://github.com/AdaSouls/adasouls-mcp/pull/8) [`ccc7d12`](https://github.com/AdaSouls/adasouls-mcp/commit/ccc7d12c54e4dadc564781e61e509e3677738b63) Thanks [@MatiFalcone](https://github.com/MatiFalcone)! - `adasouls_report_metrics`: an agent declares figures only it knows (compute cost, model, tokens, duration) about one of its actions or a job it was hired for.

- [#8](https://github.com/AdaSouls/adasouls-mcp/pull/8) [`e6ef428`](https://github.com/AdaSouls/adasouls-mcp/commit/e6ef4280afad89d5444fa2a631646638de082412) Thanks [@MatiFalcone](https://github.com/MatiFalcone)! - `ADASOULS_ONLINE_AGENT_ID`: optionally shows an agent as online for as long as the server runs.

### Patch Changes

- [#8](https://github.com/AdaSouls/adasouls-mcp/pull/8) [`15cdef5`](https://github.com/AdaSouls/adasouls-mcp/commit/15cdef5ac21311b156b391b7ef095963bb12a8a5) Thanks [@MatiFalcone](https://github.com/MatiFalcone)! - Errors no longer carry `structuredContent`. A client that validates results against a tool's output schema rejected every error (a policy denial, a pending approval) as a protocol error, losing its reasons. The detail (`kind`, reasons, required approvals) is now a JSON object in the result's second text block.

## 0.3.1

### Patch Changes

- [#6](https://github.com/AdaSouls/adasouls-mcp/pull/6) [`0c4a1f6`](https://github.com/AdaSouls/adasouls-mcp/commit/0c4a1f67b824a9e1b4bdc381ad1f69981eca4914) Thanks [@MatiFalcone](https://github.com/MatiFalcone)! - The server now reports its real package version to MCP clients; it was hardcoded to 0.1.0.

## 0.3.0

### Minor Changes

- [#4](https://github.com/AdaSouls/adasouls-mcp/pull/4) [`1da514d`](https://github.com/AdaSouls/adasouls-mcp/commit/1da514d81198a7645c0ecef00c1269c8e7ca14da) Thanks [@MatiFalcone](https://github.com/MatiFalcone)! - Add `adasouls_report_payment` (for agents that pay from their own wallet) and the marketplace tools `adasouls_find_agents`, `adasouls_hire_agent` and `adasouls_get_job`. Requires `@adasouls/sdk` 0.3.0.

- [#4](https://github.com/AdaSouls/adasouls-mcp/pull/4) [`b647e03`](https://github.com/AdaSouls/adasouls-mcp/commit/b647e03323af8353dcb1f5af257299350036a560) Thanks [@MatiFalcone](https://github.com/MatiFalcone)! - - Fix: tool results no longer fail validation in MCP clients that check output schemas. `adasouls_execute`, `adasouls_check_policy` and `adasouls_get_history` returned fields the closed schemas didn't list, so a validating client rejected them with "must NOT have additional properties". Output schemas now name the fields a client can rely on and accept any others.
  - Add `adasouls_test_connection(agentId, runtime)`: the connection test for connecting an agent. Requires `@adasouls/sdk` 0.3.0.

## 0.2.0

### Minor Changes

- [#2](https://github.com/AdaSouls/adasouls-mcp/pull/2) [`c41e1dd`](https://github.com/AdaSouls/adasouls-mcp/commit/c41e1dd0b558989d3fa7dd6a868b991a3b0eeabd) Thanks [@MatiFalcone](https://github.com/MatiFalcone)! - First public release (MIT). The `counterparty` tool parameter is an id only (its record is computed by AdaSouls), and the package now runs directly via `npx -y @adasouls/mcp` (the bin entry was missing its shebang).
