---
"@adasouls/mcp": patch
---

Errors no longer carry `structuredContent`. A client that validates results against a tool's output schema rejected every error (a policy denial, a pending approval) as a protocol error, losing its reasons. The detail (`kind`, reasons, required approvals) is now a JSON object in the result's second text block.
