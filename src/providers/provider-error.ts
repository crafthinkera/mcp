const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

function normalizeCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  return SAFE_ERROR_CODE.test(code) ? code : null;
}

function codeFromPayload(detail: string): string {
  try {
    const raw = JSON.parse(detail) as Record<string, unknown>;
    const nested = raw.error as Record<string, unknown> | undefined;
    return normalizeCode(nested?.code)
      ?? normalizeCode(nested?.status)
      ?? normalizeCode(raw.code)
      ?? normalizeCode(raw.status)
      ?? "PROVIDER_ERROR";
  } catch {
    return "PROVIDER_ERROR";
  }
}

/**
 * Keep raw provider responses out of MCP tool content. They may be written to
 * local stderr only when an operator deliberately enables debugging.
 */
export function providerHttpError(input: {
  provider: "gemini" | "meshy";
  operation: string;
  status: number;
  detail: string;
}): Error {
  if (process.env.CRAFTHINKERA_DEBUG_PROVIDER_ERRORS === "1" && input.detail) {
    console.error(`[crafty] ${input.provider} ${input.operation} HTTP ${input.status}: ${input.detail}`);
  }
  return new Error(
    `${input.provider}_${input.operation}_failed:${input.status}:${codeFromPayload(input.detail)}`,
  );
}

export function providerErrorCode(detail: string): string {
  return codeFromPayload(detail);
}
