import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  AdaSoulsApprovalPending,
  AdaSoulsAuthError,
  AdaSoulsNoDelegationError,
  AdaSoulsPolicyError,
  AdaSoulsProviderError,
  AdaSoulsRateLimitError,
  AdaSoulsValidationError,
} from "@adasouls/sdk";

/**
 * REPOSITORY.md's "Failure modes": "Maps adasouls-api/SDK errors to MCP
 * tool error responses with enough detail (policy reasons, approval
 * requirements) for the calling agent to reason about what to do next
 * -- not just a generic failure." A bare try/throw would lose exactly
 * that detail (the calling LLM only ever sees the result's `content`),
 * so every SDK error type maps to
 * its own descriptive response instead of one generic error branch.
 */
export function toToolError(err: unknown): CallToolResult {
  if (err instanceof AdaSoulsPolicyError) {
    return errorResult(`Policy denied: ${err.message}`, { kind: "policy_denied", reasons: err.reasons, approvalsRequired: err.approvalsRequired });
  }
  if (err instanceof AdaSoulsApprovalPending) {
    return errorResult(err.message, { kind: "approval_pending", economicActionId: err.economicActionId, approvalsRequired: err.approvalsRequired });
  }
  if (err instanceof AdaSoulsProviderError) {
    return errorResult(err.message, { kind: "provider_error", economicActionId: err.economicActionId, result: err.result });
  }
  if (err instanceof AdaSoulsAuthError) {
    return errorResult(`Authentication failed: ${err.message}`, { kind: "auth_error" });
  }
  if (err instanceof AdaSoulsValidationError) {
    return errorResult(`Invalid request: ${err.message}`, { kind: "validation_error" });
  }
  if (err instanceof AdaSoulsRateLimitError) {
    return errorResult(err.message, { kind: "rate_limited", retryAfterSeconds: err.retryAfterSeconds });
  }
  if (err instanceof AdaSoulsNoDelegationError) {
    return errorResult(err.message, { kind: "no_delegation" });
  }
  const message = err instanceof Error ? err.message : String(err);
  return errorResult(message, { kind: "unknown_error" });
}

/**
 * The detail goes in a second text block, as JSON -- not in
 * `structuredContent`, which a client validates against the tool's output
 * schema even on an error: a denial would then reach the agent as a
 * protocol error ("does not match the tool's output schema") with its
 * reasons lost.
 */
function errorResult(message: string, detail: Record<string, unknown>): CallToolResult {
  return { content: [{ type: "text", text: message }, { type: "text", text: JSON.stringify(detail) }], isError: true };
}
