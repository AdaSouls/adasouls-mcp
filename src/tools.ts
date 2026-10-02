import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AdaSouls } from "@adasouls/sdk";
import { toToolError } from "./errors.js";

/**
 * Every tool here is a direct pass-through to @adasouls/sdk -- zero
 * independent policy/authorization/execution logic (ADR-009). Tool
 * names and input shapes mirror 06-api-contracts.md's MCP tool surface
 * one-for-one: adasouls_get_identity/reputation/authority/check_policy/
 * execute/get_history, plus adasouls_test_connection for connecting an
 * agent.
 */

/**
 * Output schemas are open: they name the fields a client can rely on and
 * accept any others. The API adds fields over time, and a closed schema
 * makes a validating MCP client reject the whole result ("must NOT have
 * additional properties") the moment it does.
 */
const open = <T extends z.ZodRawShape>(shape: T) => z.object(shape).passthrough();

/** MCP's structuredContent is typed Record<string, unknown> -- @adasouls/sdk's return types are plain interfaces without an index signature, so TS needs an explicit boundary cast here. */
function structured(value: object): Record<string, unknown> {
  return value as Record<string, unknown>;
}

const agentIdParam = { agentId: z.string().min(1).describe("The ALMA agent identifier, e.g. alma:main:agent:...") };

const intentParams = {
  capability: z.string().min(1).describe('The economic capability, e.g. "pay"'),
  amount: z.string().optional(),
  asset: z.string().optional().describe('e.g. "USDC"'),
  to: z.string().optional().describe("Recipient identifier"),
  detail: z.record(z.string(), z.unknown()).optional(),
};

const counterpartyParam = {
  counterparty: z
    .object({
      id: z.string(),
    })
    .optional()
    .describe("Who the agent would transact with (ALMA id). Its record -- completed transactions, disputes -- is computed by AdaSouls from receipts, never supplied here."),
};

const policyEvaluationSchema = open({ allowed: z.boolean(), reasons: z.array(z.string()), approvalsRequired: z.array(z.string()) });

const economicActionSchema = open({
  id: z.string(),
  agentId: z.string(),
  capability: z.string(),
  status: z.string(),
  intent: z.record(z.string(), z.unknown()),
  policyEvaluation: z.record(z.string(), z.unknown()).nullish(),
  execution: z.record(z.string(), z.unknown()).nullish(),
  result: z.record(z.string(), z.unknown()).nullish(),
  needsReconciliation: z.boolean(),
  createdAt: z.string(),
});

export function registerTools(server: McpServer, adasouls: AdaSouls) {
  server.registerTool(
    "adasouls_get_identity",
    {
      title: "Get agent identity",
      description: "Returns an agent's ALMA identity (id, subjectType, displayName, principal).",
      inputSchema: agentIdParam,
      outputSchema: open({
        id: z.string(),
        subjectType: z.literal("agent"),
        displayName: z.string(),
        status: z.string(),
        principal: z.string(),
        createdAt: z.string(),
      }),
    },
    async ({ agentId }) => {
      try {
        const identity = await adasouls.agent(agentId).identity();
        return { content: [{ type: "text", text: JSON.stringify(identity) }], structuredContent: structured(identity) };
      } catch (err) {
        return toToolError(err);
      }
    }
  );

  server.registerTool(
    "adasouls_get_reputation",
    {
      title: "Get agent reputation",
      description: "Returns an agent's raw reputation evidence (v1: evidence rows, not a computed score, per ADR-010).",
      inputSchema: agentIdParam,
      outputSchema: open({ agentId: z.string(), evidence: z.array(z.record(z.string(), z.unknown())) }),
    },
    async ({ agentId }) => {
      try {
        const reputation = await adasouls.agent(agentId).reputation();
        return { content: [{ type: "text", text: JSON.stringify(reputation) }], structuredContent: structured(reputation) };
      } catch (err) {
        return toToolError(err);
      }
    }
  );

  server.registerTool(
    "adasouls_get_authority",
    {
      title: "Get agent authority",
      description: "Returns an agent's currently active delegations and the policies that apply to it.",
      inputSchema: agentIdParam,
      outputSchema: open({
        agentId: z.string(),
        activeDelegations: z.array(z.record(z.string(), z.unknown())),
        policySummary: z.array(z.record(z.string(), z.unknown())),
      }),
    },
    async ({ agentId }) => {
      try {
        const authority = await adasouls.agent(agentId).authority();
        return { content: [{ type: "text", text: JSON.stringify(authority) }], structuredContent: structured(authority) };
      } catch (err) {
        return toToolError(err);
      }
    }
  );

  server.registerTool(
    "adasouls_check_policy",
    {
      title: "Check policy",
      description: "Checks whether an intent would be allowed right now, without creating an EconomicAction.",
      inputSchema: { ...agentIdParam, ...intentParams, ...counterpartyParam },
      outputSchema: policyEvaluationSchema,
    },
    async ({ agentId, ...input }) => {
      try {
        const evaluation = await adasouls.agent(agentId).checkPolicy(input);
        return { content: [{ type: "text", text: JSON.stringify(evaluation) }], structuredContent: structured(evaluation) };
      } catch (err) {
        return toToolError(err);
      }
    }
  );

  server.registerTool(
    "adasouls_execute",
    {
      title: "Execute an economic action",
      description:
        "Creates and (non-blocking by default) starts executing an EconomicAction. Throws/returns an error result if the policy engine denies it or it needs human approval -- see the returned isError/structuredContent.kind.",
      inputSchema: {
        ...agentIdParam,
        ...intentParams,
        ...counterpartyParam,
        delegationId: z.string().optional().describe("Resolved automatically from the agent's active delegations when omitted."),
        idempotencyKey: z.string().optional(),
        wait: z.boolean().optional().describe("Block until the action reaches a terminal state (confirmed/failed). Default false."),
      },
      outputSchema: economicActionSchema,
    },
    async ({ agentId, ...input }) => {
      try {
        const handle = await adasouls.agent(agentId).execute(input);
        return { content: [{ type: "text", text: JSON.stringify(handle.action) }], structuredContent: structured(handle.action) };
      } catch (err) {
        return toToolError(err);
      }
    }
  );

  server.registerTool(
    "adasouls_get_history",
    {
      title: "Get economic action history",
      description: "Lists an agent's EconomicActions, most recent first -- the audit trail a console would render.",
      inputSchema: { ...agentIdParam, cursor: z.string().optional(), limit: z.number().int().positive().optional() },
      outputSchema: open({ items: z.array(z.record(z.string(), z.unknown())), nextCursor: z.string().optional() }),
    },
    async ({ agentId, cursor, limit }) => {
      try {
        const page = await adasouls.agent(agentId).history({ cursor, limit });
        return { content: [{ type: "text", text: JSON.stringify(page) }], structuredContent: structured(page) };
      } catch (err) {
        return toToolError(err);
      }
    }
  );

  server.registerTool(
    "adasouls_test_connection",
    {
      title: "Test the agent's connection",
      description:
        "Run once when connecting an agent to AdaSouls: proves this runtime holds a working key for the agent and runs a simulated action of amount 0 through the same authority and policy checks a real one gets. Nothing is paid and no reputation is added. A failed test is a normal result (ok: false, with reasons), not an error.",
      inputSchema: {
        ...agentIdParam,
        runtime: z.string().min(1).max(120).describe('What this runtime calls itself, e.g. "claude-desktop". Shown to the agent\'s owners; never used to decide anything.'),
        capability: z.string().optional().describe("Defaults to the first capability the agent has been delegated."),
        asset: z.string().optional().describe('Defaults to "USDC".'),
      },
      outputSchema: open({
        ok: z.boolean(),
        reasons: z.array(z.string()),
        checks: open({ credential: z.boolean(), authority: z.boolean(), policies: z.boolean() }),
        economicActionId: z.string().nullable(),
        instanceId: z.string().nullable(),
        status: z.string(),
      }),
    },
    async ({ agentId, ...input }) => {
      try {
        const result = await adasouls.agent(agentId).testConnection(input);
        return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: structured(result) };
      } catch (err) {
        return toToolError(err);
      }
    }
  );
}
