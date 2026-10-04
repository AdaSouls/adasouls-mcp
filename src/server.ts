import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AdaSouls } from "@adasouls/sdk";
import { registerTools } from "./tools.js";
import { createRequire } from "node:module";

/**
 * The version this server reports to MCP clients: the package's own,
 * read from package.json (always shipped next to dist/), so it can't
 * drift from what was published.
 */
export const SERVER_VERSION: string = (createRequire(import.meta.url)("../package.json") as { version: string }).version;

export interface CreateServerOptions {
  apiKey: string;
  baseUrl?: string;
  /**
   * Optional: an agent to show as online for as long as this server
   * runs (the api key must be that agent's own). Without it the agent is
   * shown by its last activity.
   */
  onlineAgentId?: string;
}

/**
 * Builds the MCP server and registers its tools -- separated from
 * src/index.ts's stdio wiring so tests can connect it over
 * InMemoryTransport instead of spawning a real process.
 */
export function createServer(options: CreateServerOptions): McpServer {
  const server = new McpServer({ name: "adasouls-mcp", version: SERVER_VERSION });
  const adasouls = new AdaSouls({ apiKey: options.apiKey, baseUrl: options.baseUrl });
  registerTools(server, adasouls);
  if (options.onlineAgentId) {
    // stderr: stdout belongs to the MCP transport.
    adasouls.agent(options.onlineAgentId).stayOnline({ onError: (err) => console.error(`[adasouls-mcp] online signal failed: ${err instanceof Error ? err.message : String(err)}`) });
  }
  return server;
}
