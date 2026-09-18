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
  it("exposes exactly the six documented tools", async () => {
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
});
