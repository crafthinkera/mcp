#!/usr/bin/env node
import { runStdioBridge } from "./bridge.js";
import { configFromEnvironment, parseConfig } from "./config.js";

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
const config = suppliedUrl || suppliedToken
  ? parseConfig({ url: suppliedUrl, token: suppliedToken })
  : configFromEnvironment();

runStdioBridge(config).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "CrafThinkERA MCP bridge failed.");
  process.exitCode = 1;
});
