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
  return server;
}
