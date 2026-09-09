export const DEFAULT_MCP_URL = "https://www.crafthinkera.com/api/mcp";

export interface CrafThinkeraMcpConfig {
  url: URL;
  token: string;
}

export class CrafThinkeraMcpConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrafThinkeraMcpConfigError";
  }
}

export function parseConfig(input: {
  url?: string;
  token?: string;
}): CrafThinkeraMcpConfig {
  const token = input.token?.trim();
  if (!token) {
    throw new CrafThinkeraMcpConfigError(
      "Missing CrafThinkERA token. Set CRAFTHINKERA_MCP_TOKEN.",
    );
  }

  let url: URL;
  try {
    url = new URL(input.url?.trim() || DEFAULT_MCP_URL);
  } catch {
    throw new CrafThinkeraMcpConfigError("CRAFTHINKERA_MCP_URL must be a valid URL.");
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new CrafThinkeraMcpConfigError("MCP URL must not contain credentials, query parameters or a fragment.");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new CrafThinkeraMcpConfigError(
      "CRAFTHINKERA_MCP_URL must use HTTPS (HTTP is allowed only for localhost).",
    );
  }

  return { url, token };
}

export function configFromEnvironment(env = process.env): CrafThinkeraMcpConfig {
  return parseConfig({
    url: env.CRAFTHINKERA_MCP_URL,
    token: env.CRAFTHINKERA_MCP_TOKEN,
  });
}
