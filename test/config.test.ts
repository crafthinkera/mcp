import assert from "node:assert/strict";
import test from "node:test";
import {
  CrafThinkeraMcpConfigError,
  DEFAULT_MCP_URL,
  parseConfig,
  requireRemoteToken,
} from "../src/config.js";

test("local mode starts without a CrafThinkERA token", () => {
  const config = parseConfig({ geminiApiKey: "gem_test", meshyApiKey: "meshy_test" });
  assert.equal(config.url.href, DEFAULT_MCP_URL);
  assert.equal(config.token, undefined);
  assert.equal(config.geminiApiKey, "gem_test");
  assert.equal(config.meshyApiKey, "meshy_test");
});

test("hosted bridge still requires a ctk token", () => {
  assert.throws(() => requireRemoteToken(parseConfig()), CrafThinkeraMcpConfigError);
  assert.equal(requireRemoteToken(parseConfig({ token: "ctk_test" })), "ctk_test");
});

test("allows HTTP only for a local development endpoint", () => {
  assert.equal(
    parseConfig({ url: "http://localhost:3001/api/mcp" }).url.href,
    "http://localhost:3001/api/mcp",
  );
  assert.throws(
    () => parseConfig({ url: "http://example.com/api/mcp" }),
    CrafThinkeraMcpConfigError,
  );
});

test("rejects non-CrafThinkERA token prefixes", () => {
  assert.throws(() => parseConfig({ token: "not-a-ctk-token" }), CrafThinkeraMcpConfigError);
});
