#!/usr/bin/env node
import { runStdioBridge } from "./bridge.js";
import { parseConfig } from "./config.js";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.error(`Usage: crafthinkera-mcp [--url https://…/api/mcp] [--token ctk_…]

Environment:
  CRAFTHINKERA_MCP_TOKEN  required bearer token
  CRAFTHINKERA_MCP_URL    remote MCP endpoint (defaults to CrafThinkERA production)`);
  process.exit(0);
}

const suppliedUrl = option("--url");
const suppliedToken = option("--token");
async function main() {
  const config = parseConfig({
    url: suppliedUrl ?? process.env.CRAFTHINKERA_MCP_URL,
    token: suppliedToken ?? process.env.CRAFTHINKERA_MCP_TOKEN,
  });
  await runStdioBridge(config);
}
main().catch(() => {
  console.error("CrafThinkERA MCP connection failed. Check endpoint, token and network access.");
  process.exitCode = 1;
});
