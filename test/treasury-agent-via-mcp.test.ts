import { describe, expect, it } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { AdaSouls } from "@adasouls/sdk";
import { registerTools } from "../src/tools.js";

/**
 * Phase 8's actual exit criterion (docs/20-roadmap.md): "the Treasury
 * Agent demo also runs via an MCP client, proving MCP is a true adapter
 * (ADR-009) and not a second implementation." Runs the exact same
 * scenario reference-agents/treasury-agent's src/treasury-agent.ts does
 * -- "put 500 USDC of idle treasury to work," with a counterparty that
 * satisfies the fixture's minCompletedTransactions policy -- but calling
 * it through MCP tools instead of the SDK directly, against a real,
 * locally-running adasouls-api.
 *
 * Fixture comes from `npm run create-treasury-agent-test-fixture` in
 * adasouls-api (same one reference-agents/treasury-agent's own
 * integration suite uses) -- same self+counterparty policies, same
 * delegation shape.
 */
const baseUrl = process.env.ADASOULS_API_URL;
const apiKey = process.env.ADASOULS_TEST_API_KEY;
const agentId = process.env.ADASOULS_TEST_AGENT_ID;
// Registered vendor with real (fixture) history: the API computes its record.
const vendorId = process.env.ADASOULS_TEST_VENDOR_ID;

async function connectedClient() {
  const server = new McpServer({ name: "test", version: "0.0.1" });
  const adasouls = new AdaSouls({ apiKey: apiKey!, baseUrl });
  registerTools(server, adasouls);

  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

describe.skipIf(!baseUrl || !apiKey || !agentId || !vendorId)("Treasury Agent demo via MCP (Phase 8 exit criterion)", () => {
  it("puts 500 USDC of idle treasury to work through MCP tool calls, matching the SDK-based demo's behavior", async () => {
    const client = await connectedClient();

    const identityResult = await client.callTool({ name: "adasouls_get_identity", arguments: { agentId } });
    expect(identityResult.isError).toBeFalsy();
    expect((identityResult.structuredContent as { id: string }).id).toBe(agentId);

    const checkResult = await client.callTool({
      name: "adasouls_check_policy",
      arguments: {
        agentId,
        capability: "pay",
        amount: "500",
        asset: "USDC",
        counterparty: { id: vendorId! },
      },
    });
    expect((checkResult.structuredContent as { allowed: boolean }).allowed).toBe(true);

    const executeResult = await client.callTool({
      name: "adasouls_execute",
      arguments: {
        agentId,
        capability: "pay",
        amount: "500",
        asset: "USDC",
        to: vendorId!,
        counterparty: { id: vendorId! },
      },
    });
    expect(executeResult.isError).toBeFalsy();
    const action = executeResult.structuredContent as { id: string; status: string };
    expect(["authorized", "executing", "confirmed"]).toContain(action.status);

    const historyResult = await client.callTool({ name: "adasouls_get_history", arguments: { agentId, limit: 10 } });
    const history = historyResult.structuredContent as { items: { id: string }[] };
    expect(history.items.some((item) => item.id === action.id)).toBe(true);
  });

  it("rejects a payment to a counterparty that fails the counterparty policy, exactly like the SDK version", async () => {
    const client = await connectedClient();

    const result = await client.callTool({
      name: "adasouls_execute",
      arguments: {
        agentId,
        capability: "pay",
        amount: "10",
        asset: "USDC",
        to: "agent_untrusted_vendor",
        counterparty: { id: "agent_untrusted_vendor" },
      },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ kind: "policy_denied" });
    expect((result.structuredContent as { reasons: string[] }).reasons.join(" ")).toContain("completed transactions");
  });
});
