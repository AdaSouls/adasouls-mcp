import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { AdaSouls } from "@adasouls/sdk";
import { AdaSoulsPolicyError, AdaSoulsApprovalPending, AdaSoulsNoDelegationError } from "@adasouls/sdk";
import { registerTools } from "../src/tools.js";

/**
 * Tool-level tests against a mocked SDK, per adasouls-mcp/REPOSITORY.md's
 * testing strategy -- proves the tool registrations (names, schemas,
 * error mapping) are correct without needing a real adasouls-api.
 */
async function connectedClient(fakeAdaSouls: AdaSouls) {
  const server = new McpServer({ name: "test", version: "0.0.1" });
  registerTools(server, fakeAdaSouls);

  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

function fakeAdaSouls(agentMethods: Record<string, (...args: never[]) => unknown>): AdaSouls {
  return { agent: () => agentMethods } as unknown as AdaSouls;
}

describe("adasouls-mcp tools", () => {
  it("exposes exactly the documented tools", async () => {
    const client = await connectedClient(fakeAdaSouls({}));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        "adasouls_get_identity",
        "adasouls_get_reputation",
        "adasouls_get_authority",
        "adasouls_check_policy",
        "adasouls_execute",
        "adasouls_get_history",
        "adasouls_test_connection",
        "adasouls_report_payment",
        "adasouls_report_metrics",
        "adasouls_find_agents",
        "adasouls_hire_agent",
        "adasouls_get_job",
      ].sort()
    );
  });

  it("adasouls_get_identity passes agentId through and returns structuredContent", async () => {
    const identity = vi.fn().mockResolvedValue({ id: "agent_1", subjectType: "agent", displayName: "A", status: "active", principal: "p", createdAt: "now" });
    const client = await connectedClient(fakeAdaSouls({ identity }));

    const result = await client.callTool({ name: "adasouls_get_identity", arguments: { agentId: "agent_1" } });

    expect(identity).toHaveBeenCalled();
    expect(result.isError).toBeFalsy();
    expect((result.structuredContent as { id: string }).id).toBe("agent_1");
  });

  it("adasouls_execute maps a policy denial to an isError result carrying reasons, not a protocol-level throw", async () => {
    const execute = vi.fn().mockRejectedValue(new AdaSoulsPolicyError("policy denied", ["exceeds limit"], []));
    const client = await connectedClient(fakeAdaSouls({ execute }));

    const result = await client.callTool({
      name: "adasouls_execute",
      arguments: { agentId: "agent_1", capability: "pay", amount: "999999", asset: "USDC" },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ kind: "policy_denied", reasons: ["exceeds limit"] });
  });

  it("adasouls_execute maps approval-pending distinctly from a policy denial", async () => {
    const execute = vi.fn().mockRejectedValue(new AdaSoulsApprovalPending("needs approval", "eco_1", ["human_approval"]));
    const client = await connectedClient(fakeAdaSouls({ execute }));

    const result = await client.callTool({
      name: "adasouls_execute",
      arguments: { agentId: "agent_1", capability: "pay", amount: "200", asset: "USDC" },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ kind: "approval_pending", economicActionId: "eco_1" });
  });

  it("adasouls_execute maps a missing-delegation error too", async () => {
    const execute = vi.fn().mockRejectedValue(new AdaSoulsNoDelegationError("no delegation covers this"));
    const client = await connectedClient(fakeAdaSouls({ execute }));

    const result = await client.callTool({
      name: "adasouls_execute",
      arguments: { agentId: "agent_1", capability: "hire", amount: "1", asset: "USDC" },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ kind: "no_delegation" });
  });

  it("adasouls_check_policy never errors on a denial -- returns allowed:false in structuredContent", async () => {
    const checkPolicy = vi.fn().mockResolvedValue({ allowed: false, reasons: ["exceeds limit"], approvalsRequired: [] });
    const client = await connectedClient(fakeAdaSouls({ checkPolicy }));

    const result = await client.callTool({
      name: "adasouls_check_policy",
      arguments: { agentId: "agent_1", capability: "pay", amount: "999999", asset: "USDC" },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ allowed: false });
  });

  it("adasouls_get_history passes cursor/limit through", async () => {
    const history = vi.fn().mockResolvedValue({ items: [], nextCursor: undefined });
    const client = await connectedClient(fakeAdaSouls({ history }));

    await client.callTool({ name: "adasouls_get_history", arguments: { agentId: "agent_1", limit: 5 } });

    expect(history).toHaveBeenCalledWith({ cursor: undefined, limit: 5 });
  });

  /**
   * A real MCP client lists tools first and then validates every result
   * against the tool's output schema. The API returns more fields than
   * the schemas name, and adds more over time, so the schemas must accept
   * them -- these use the shapes adasouls-api actually sends.
   */
  describe("results validate for a client that listed the tools", () => {
    const action = {
      id: "eco_1",
      principalId: "alma:main:organization:acme",
      agentId: "agent_1",
      agentInstanceId: null,
      intent: { capability: "pay", amount: "1", asset: "USDC" },
      capability: "pay",
      counterparty: null,
      authority: { delegationId: "del_1", policySnapshot: [] },
      policyEvaluation: { allowed: true, reasons: [], approvalsRequired: [], matchedPolicies: [], inputs: { counterparty: null, dailySpendSoFar: {} } },
      executionPlan: null,
      approval: null,
      execution: null,
      status: "authorized",
      result: null,
      needsReconciliation: false,
      idempotencyKey: null,
      createdAt: "2026-10-02T00:00:00.000Z",
    };
    const listed = async (methods: Record<string, (...args: never[]) => unknown>) => {
      const client = await connectedClient(fakeAdaSouls(methods));
      await client.listTools();
      return client;
    };

    it("adasouls_execute", async () => {
      const client = await listed({ execute: vi.fn().mockResolvedValue({ action }) });
      const result = await client.callTool({ name: "adasouls_execute", arguments: { agentId: "agent_1", capability: "pay", amount: "1", asset: "USDC" } });
      expect(result.isError).toBeFalsy();
      expect((result.structuredContent as { authority: unknown }).authority).toEqual(action.authority);
    });

    it("adasouls_check_policy", async () => {
      const client = await listed({ checkPolicy: vi.fn().mockResolvedValue(action.policyEvaluation) });
      const result = await client.callTool({ name: "adasouls_check_policy", arguments: { agentId: "agent_1", capability: "pay" } });
      expect(result.isError).toBeFalsy();
    });

    it("adasouls_get_identity with a field the schema doesn't name", async () => {
      const identity = vi.fn().mockResolvedValue({ id: "agent_1", subjectType: "agent", displayName: "A", status: "active", principal: "p", createdAt: "now", somethingNew: 1 });
      const client = await listed({ identity });
      expect((await client.callTool({ name: "adasouls_get_identity", arguments: { agentId: "agent_1" } })).isError).toBeFalsy();
    });

    it("adasouls_get_history", async () => {
      const client = await listed({ history: vi.fn().mockResolvedValue({ items: [action] }) });
      expect((await client.callTool({ name: "adasouls_get_history", arguments: { agentId: "agent_1" } })).isError).toBeFalsy();
    });
  });

  it("adasouls_test_connection passes the runtime through; a failed test is a normal result with its reasons", async () => {
    const failed = { ok: false, reasons: ["no policy applies to this agent"], checks: { credential: true, authority: true, policies: false }, economicActionId: null, instanceId: null, status: "identity_issued" };
    const testConnection = vi.fn().mockResolvedValue(failed);
    const client = await connectedClient(fakeAdaSouls({ testConnection }));
    await client.listTools();

    const result = await client.callTool({ name: "adasouls_test_connection", arguments: { agentId: "agent_1", runtime: "claude-desktop" } });

    expect(testConnection).toHaveBeenCalledWith({ runtime: "claude-desktop" });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(failed);
  });

  describe("self-paid actions and the marketplace", () => {
    const action = { id: "eco_1", agentId: "agent_1", capability: "hire", status: "authorized", intent: {}, needsReconciliation: false, createdAt: "now", authority: {}, executionPlan: { mode: "self" } };
    const job = { id: "job_1", status: "awaiting_payment", service: "analyze-protocol", result: null, error: null, price: { amount: "0.10", asset: "USDC" } };
    const payment = { economicActionId: "eco_1", chain: "mock-chain", from: "0xa", to: "0xb", amount: "0.10", asset: "USDC" };

    it("adasouls_hire_agent returns the job, the action and the payment to make", async () => {
      const hire = vi.fn().mockResolvedValue({ job, action: { action }, payment });
      const client = await connectedClient(fakeAdaSouls({ hire }));
      await client.listTools();
      const result = await client.callTool({ name: "adasouls_hire_agent", arguments: { agentId: "agent_1", listingId: "lst_1", service: "analyze-protocol", input: { protocol: "aave" } } });
      expect(hire).toHaveBeenCalledWith("lst_1", { service: "analyze-protocol", input: { protocol: "aave" } });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({ job: { id: "job_1" }, action: { id: "eco_1" }, payment });
    });

    it("adasouls_report_metrics declares figures about an action or a job, never both or neither", async () => {
      const report = vi.fn().mockResolvedValue([{ id: "arp_1", metric: "compute_cost", value: "0.0421", unit: "USD", reportedAt: "2026-10-04T12:00:00Z", envelope: {}, log: null }]);
      const client = await connectedClient(fakeAdaSouls({ report }));
      await client.listTools();

      const figures = { computeCost: { amount: "0.0421", currency: "USD" }, inputTokens: 1820 };
      const ok = await client.callTool({ name: "adasouls_report_metrics", arguments: { agentId: "agent_1", economicActionId: "eco_1", ...figures } });
      expect(report).toHaveBeenCalledWith({ action: "eco_1" }, figures);
      expect(ok.isError).toBeFalsy();
      expect(ok.structuredContent).toMatchObject({ reports: [{ id: "arp_1", value: "0.0421", unit: "USD" }] });

      await client.callTool({ name: "adasouls_report_metrics", arguments: { agentId: "agent_1", jobId: "job_1", model: "m" } });
      expect(report).toHaveBeenLastCalledWith({ job: "job_1" }, { model: "m" });

      // Like the other error tests here, on a client that hasn't listed the tools.
      const fresh = await connectedClient(fakeAdaSouls({ report }));
      for (const args of [{ model: "m" }, { economicActionId: "eco_1", jobId: "job_1", model: "m" }]) {
        const bad = await fresh.callTool({ name: "adasouls_report_metrics", arguments: { agentId: "agent_1", ...args } });
        expect(bad.isError).toBe(true);
      }
      expect(report).toHaveBeenCalledTimes(2);
    });

    it("adasouls_report_payment, adasouls_find_agents and adasouls_get_job pass through", async () => {
      const reportPayment = vi.fn().mockResolvedValue({ action: { ...action, status: "executing" } });
      const findAgents = vi.fn().mockResolvedValue([{ id: "lst_1", title: "Research" }]);
      const getJob = vi.fn().mockResolvedValue({ ...job, status: "completed", result: { risk: "low" } });
      const client = await connectedClient(fakeAdaSouls({ reportPayment, findAgents, job: getJob }));
      await client.listTools();

      const reported = await client.callTool({ name: "adasouls_report_payment", arguments: { agentId: "agent_1", economicActionId: "eco_1", txHash: "0xabc" } });
      expect(reportPayment).toHaveBeenCalledWith("eco_1", "0xabc");
      expect(reported.structuredContent).toMatchObject({ status: "executing" });

      const found = await client.callTool({ name: "adasouls_find_agents", arguments: { agentId: "agent_1", capability: "analyze-protocol" } });
      expect(findAgents).toHaveBeenCalledWith({ capability: "analyze-protocol" });
      expect(found.structuredContent).toEqual({ items: [{ id: "lst_1", title: "Research" }] });

      const got = await client.callTool({ name: "adasouls_get_job", arguments: { agentId: "agent_1", jobId: "job_1" } });
      expect(got.structuredContent).toMatchObject({ status: "completed", result: { risk: "low" } });
    });
  });
});

describe("server info", () => {
  it("reports the package's own version, not a hardcoded one", async () => {
    const { createServer, SERVER_VERSION } = await import("../src/server.js");
    const pkg = JSON.parse(await (await import("node:fs/promises")).readFile(new URL("../package.json", import.meta.url), "utf8"));
    expect(SERVER_VERSION).toBe(pkg.version);
    expect(typeof createServer).toBe("function");
  });
});
