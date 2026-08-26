import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import type { CrafThinkeraMcpConfig } from "./config.js";

const PACKAGE_VERSION = "0.1.0";

async function listAllTools(client: Client): Promise<Tool[]> {
  const tools: Tool[] = [];
  let cursor: string | undefined;

  do {
    const page = await client.listTools(cursor ? { cursor } : undefined);
    tools.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);

  return tools;
}

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
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/json, text/event-stream",
      },
    },
  });

  await remote.connect(remoteTransport);
  const tools = await listAllTools(remote);

  const local = new Server(
    { name: "crafthinkera", version: PACKAGE_VERSION },
    { capabilities: { tools: {} } },
  );
  local.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  local.setRequestHandler(CallToolRequestSchema, async (request) =>
    remote.callTool({
      name: request.params.name,
      arguments: request.params.arguments,
    }),
  );

  const localTransport = new StdioServerTransport();
  localTransport.onclose = () => void remote.close();
  await local.connect(localTransport);
}
