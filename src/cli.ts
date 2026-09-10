#!/usr/bin/env node
import { runStdioBridge } from "./bridge.js";
import { configFromEnvironment, parseConfig, requireRemoteToken } from "./config.js";
import { localStatus, runLocalMcp } from "./local/server.js";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function printHelp() {
  console.error(`Crafty MCP

Usage:
  crafthinkera-mcp                 Start the local BYOK MCP server on stdio
  crafthinkera-mcp doctor          Show configured capabilities (never prints keys)
  crafthinkera-mcp --remote        Bridge stdio to the hosted CrafThinkERA MCP

Local BYOK environment:
  GEMINI_API_KEY                   Optional; enables concept + reference-view generation
  MESHY_API_KEY                    Optional; enables image-to-3D generation
  CRAFTHINKERA_IMAGE_MODEL         Optional; defaults to gemini-3.1-flash-image
  CRAFTHINKERA_GEOMETRY_MODEL      Optional; defaults to meshy-6
  CRAFTHINKERA_HOME                Optional local state directory (~/.crafthinkera)

Hosted/network environment:
  CRAFTHINKERA_MCP_TOKEN           Optional in local mode; required only for --remote or network handoff
  CRAFTHINKERA_MCP_URL             Optional; defaults to https://www.crafthinkera.com/api/mcp

Examples:
  npx -y @crafthinkera/mcp doctor
  GEMINI_API_KEY=... MESHY_API_KEY=... npx -y @crafthinkera/mcp
`);
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }

  const config = parseConfig({
    ...configFromEnvironment(),
    url: option("--url") ?? process.env.CRAFTHINKERA_MCP_URL,
    token: option("--token") ?? process.env.CRAFTHINKERA_MCP_TOKEN,
  });

  if (process.argv[2] === "doctor") {
    console.log(JSON.stringify(localStatus(config), null, 2));
    return;
  }

  if (process.argv.includes("--remote")) {
    requireRemoteToken(config);
    await runStdioBridge(config);
    return;
  }

  await runLocalMcp(config);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`Crafty MCP failed: ${message}`);
  process.exitCode = 1;
});
