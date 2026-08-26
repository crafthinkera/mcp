import assert from "node:assert/strict";
import test from "node:test";
import {
  CrafThinkeraMcpConfigError,
  DEFAULT_MCP_URL,
  parseConfig,
} from "../src/config.js";

test("uses the production endpoint when only a token is supplied", () => {
  const config = parseConfig({ token: "ctk_test" });
  assert.equal(config.url.href, DEFAULT_MCP_URL);
  assert.equal(config.token, "ctk_test");
});

test("allows HTTP only for a local development endpoint", () => {
  assert.equal(
    parseConfig({ url: "http://localhost:3001/api/mcp", token: "ctk_test" }).url.href,
    "http://localhost:3001/api/mcp",
  );
  assert.throws(
    () => parseConfig({ url: "http://example.com/api/mcp", token: "ctk_test" }),
    CrafThinkeraMcpConfigError,
  );
});

test("never starts without a token", () => {
  assert.throws(() => parseConfig({}), CrafThinkeraMcpConfigError);
});
