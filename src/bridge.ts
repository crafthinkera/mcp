import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { Server } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { requireRemoteToken, type CrafThinkeraMcpConfig } from "./config.js";

const PACKAGE_VERSION = "0.3.0";

/**
 * Optional compatibility mode: present the hosted CrafThinkERA service as a
 * local stdio MCP server. The default CLI mode is now local BYOK.
 */
export async function runStdioBridge(config: CrafThinkeraMcpConfig): Promise<void> {
  const token = requireRemoteToken(config);
  const remote = new Client(
    { name: "crafthinkera-mcp-bridge", version: PACKAGE_VERSION },
    { capabilities: {} },
  );
  const remoteTransport = new StreamableHTTPClientTransport(config.url, {
    requestInit: {
      redirect: "error",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json, text/event-stream",
      },
    },
  });

  await remote.connect(remoteTransport);

  const local = new Server(
    { name: "crafthinkera", version: PACKAGE_VERSION },
    { capabilities: { tools: {} } },
  );
  local.setRequestHandler("tools/list", async (request) => {
    const result = await remote.listTools(request.params);
    return {
      tools: result.tools,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    };
  });
  local.setRequestHandler("tools/call", async (request) =>
    remote.callTool({ name: request.params.name, arguments: request.params.arguments }),
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
