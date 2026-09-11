import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_MCP_URL = "https://www.crafthinkera.com/api/mcp";
export const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image";
export const DEFAULT_GEOMETRY_MODEL = "meshy-6";
export const DEFAULT_STATE_DIR = join(homedir(), ".crafthinkera");

export interface CrafThinkeraMcpConfig {
  url: URL;
  token?: string;
  geminiApiKey?: string;
  meshyApiKey?: string;
  imageModel: string;
  geometryModel: string;
  stateDir: string;
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
  geminiApiKey?: string;
  meshyApiKey?: string;
  imageModel?: string;
  geometryModel?: string;
  stateDir?: string;
} = {}): CrafThinkeraMcpConfig {
  let url: URL;
  try {
    url = new URL(input.url?.trim() || DEFAULT_MCP_URL);
  } catch {
    throw new CrafThinkeraMcpConfigError("CRAFTHINKERA_MCP_URL must be a valid URL.");
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new CrafThinkeraMcpConfigError(
      "MCP URL must not contain credentials, query parameters or a fragment.",
    );
  }

  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new CrafThinkeraMcpConfigError(
      "CRAFTHINKERA_MCP_URL must use HTTPS (HTTP is allowed only for localhost).",
    );
  }

  const token = input.token?.trim() || undefined;
  if (token && !token.startsWith("ctk_")) {
    throw new CrafThinkeraMcpConfigError(
      "CRAFTHINKERA_MCP_TOKEN must be a CrafThinkERA ctk_ bearer token.",
    );
  }

  return {
    url,
    token,
    geminiApiKey: input.geminiApiKey?.trim() || undefined,
    meshyApiKey: input.meshyApiKey?.trim() || undefined,
    imageModel: input.imageModel?.trim() || DEFAULT_IMAGE_MODEL,
    geometryModel: input.geometryModel?.trim() || DEFAULT_GEOMETRY_MODEL,
    stateDir: input.stateDir?.trim() || DEFAULT_STATE_DIR,
  };
}

export function configFromEnvironment(env = process.env): CrafThinkeraMcpConfig {
  return parseConfig({
    url: env.CRAFTHINKERA_MCP_URL,
    token: env.CRAFTHINKERA_MCP_TOKEN,
    geminiApiKey: env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY,
    meshyApiKey: env.MESHY_API_KEY,
    imageModel: env.CRAFTHINKERA_IMAGE_MODEL || env.MAKE_IMAGE_MODEL,
    geometryModel: env.CRAFTHINKERA_GEOMETRY_MODEL || env.MAKE_GEOMETRY_MODEL,
    stateDir: env.CRAFTHINKERA_HOME,
  });
}

export function requireRemoteToken(config: CrafThinkeraMcpConfig): string {
  if (!config.token) {
    throw new CrafThinkeraMcpConfigError(
      "Hosted CrafThinkERA mode needs CRAFTHINKERA_MCP_TOKEN. Local BYOK mode does not.",
    );
  }
  return config.token;
}
