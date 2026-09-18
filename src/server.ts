import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AdaSouls } from "@adasouls/sdk";
import { registerTools } from "./tools.js";

export interface CreateServerOptions {
  apiKey: string;
  baseUrl?: string;
}

/**
 * Builds the MCP server and registers all six tools -- separated from
 * src/index.ts's stdio wiring so tests can connect it over
 * InMemoryTransport instead of spawning a real process.
 */
export function createServer(options: CreateServerOptions): McpServer {
  const server = new McpServer({ name: "adasouls-mcp", version: "0.1.0" });
  const adasouls = new AdaSouls({ apiKey: options.apiKey, baseUrl: options.baseUrl });
  registerTools(server, adasouls);
  return server;
}
