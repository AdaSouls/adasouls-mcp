import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const apiKey = process.env.ADASOULS_API_KEY;
if (!apiKey) {
  console.error("ADASOULS_API_KEY is required (see README.md).");
  process.exit(1);
}

const server = createServer({ apiKey, baseUrl: process.env.ADASOULS_API_URL });
await server.connect(new StdioServerTransport());
