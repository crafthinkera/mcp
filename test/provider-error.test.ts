import assert from "node:assert/strict";
import test from "node:test";
import { generateGeminiImage } from "../src/providers/gemini.js";
import { createMeshyTask } from "../src/providers/meshy.js";
import { providerErrorCode, providerHttpError } from "../src/providers/provider-error.js";

test("provider HTTP errors expose only status and a sanitized code", () => {
  const raw = JSON.stringify({ error: { status: "INVALID_ARGUMENT", message: "api key=secret-value" } });
  const error = providerHttpError({ provider: "gemini", operation: "image", status: 400, detail: raw });
  assert.equal(error.message, "gemini_image_failed:400:INVALID_ARGUMENT");
  assert.doesNotMatch(error.message, /secret-value|message/i);
});

test("unstructured provider errors do not become MCP error content", () => {
  assert.equal(providerErrorCode("authorization: Bearer secret-value"), "PROVIDER_ERROR");
});

test("Gemini and Meshy wrappers never return raw error responses", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Bearer secret-value" } }),
    { status: 401 },
  );
  try {
    await assert.rejects(
      () => generateGeminiImage({ apiKey: "gem_test", model: "test", prompt: "test" }),
      /gemini_image_failed:401:UNAUTHENTICATED/,
    );
    await assert.rejects(
      () => createMeshyTask({ apiKey: "meshy_test", model: "test", images: [{ bytes: Buffer.from("x"), contentType: "image/png" }] }),
      /meshy_create_failed:401:UNAUTHENTICATED/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
