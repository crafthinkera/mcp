import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { CrafThinkeraMcpConfig } from "./config.js";

const PACKAGE_VERSION = "0.1.0";

/**
 * Presents the remote CrafThinkERA service as a local stdio MCP server.
 * It never makes a production decision: schemas and calls are forwarded to the
 * authenticated HTTPS service unchanged.
 */
export async function runStdioBridge(config: CrafThinkeraMcpConfig): Promise<void> {
  const remote = new Client(
    { name: "crafthinkera-mcp-bridge", version: PACKAGE_VERSION },
    { capabilities: {} },
  );
  const remoteTransport = new StreamableHTTPClientTransport(config.url, {
    requestInit: {
      redirect: "error",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/json, text/event-stream",
      },
    },
  });

  await remote.connect(remoteTransport);

  const local = new Server(
    { name: "crafthinkera", version: PACKAGE_VERSION },
    { capabilities: { tools: {} } },
  );
  local.setRequestHandler(ListToolsRequestSchema, async (request) => remote.listTools(request.params));
  local.setRequestHandler(CallToolRequestSchema, async (request) =>
    remote.callTool({
      name: request.params.name,
      arguments: request.params.arguments,
    }),
  );

  const localTransport = new StdioServerTransport();
  local.onclose = () => void remote.close();
  try {
    await local.connect(localTransport);
  } catch (error) {
    await remote.close();
    throw error;
  }
}
