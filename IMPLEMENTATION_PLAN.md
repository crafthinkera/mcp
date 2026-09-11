# Crafty MCP v0.3 plan

## P0 — Distribution

Goal: `npx -y @crafthinkera/mcp` resolves from npm and starts a stdio MCP server.

- Publish `@crafthinkera/mcp` as a public npm scoped package.
- Keep a single `bin` entry so `npx @crafthinkera/mcp` has an unambiguous executable.
- Build `dist/` in `prepack` and verify the tarball before publish.
- Add `publishConfig.access=public`.
- Human sanity command: `npx -y @crafthinkera/mcp doctor`.

## P1 — Local BYOK runtime

Default mode requires no CrafThinkERA account or token.

- Durable local projects under `~/.crafthinkera`.
- Provider keys only from environment variables.
- No API key values in logs, MCP results or manifests.
- Gemini: canonical concept + four separate reference views.
- Meshy: 1–4 local images sent as base64 Data URIs; no public image bucket required.
- Meshy task is async: create once, poll with `check_geometry`, download GLB when ready.

## P2 — Hosted compatibility

- `--remote` preserves the current thin bridge behavior.
- `check_crafthinkera_connection` verifies a token without starting a physical operation.
- Remote production/commerce Core remains private.

## P3 — Content-addressed handoff (private Core + public client)

This is the missing contract before BYOK can flow directly into quoting.

1. Local runtime freezes a handoff manifest:
   - project intent
   - selected artifact roles
   - byte size / MIME type
   - SHA-256
   - dimensions/production metadata when available
2. Hosted MCP creates an import session bound to the agent principal and local manifest digest.
3. Hosted service returns presigned PUT URLs for each declared asset.
4. Client uploads bytes directly to owned storage; provider keys never leave the machine.
5. Hosted completion endpoint re-hashes / validates each uploaded object and persists CrafThinkERA asset IDs.
6. Only those verified asset IDs can be attached to an immutable ProductionSpecRevision.
7. Existing quote -> human approval -> payment -> ProductionJob invariants remain unchanged.

Required security properties:

- No arbitrary server-side URL fetch for imports (avoid SSRF).
- Declared maximum file sizes and accepted MIME/format allowlist.
- Upload session expiry and single-use completion.
- SHA-256 mismatch fails closed.
- Project ownership/scope check on every import operation.
- Local provider success never implies printability or production acceptance.

## P4 — Deterministic local prep

After the simpler BYOK path is stable, open-source the generic GLB validation/scale/export layer:

- GLB parse + triangle/bounds report.
- Explicit target dimensions.
- deterministic GLB/STL output.
- no CrafThinkERA routing/quality policy.
- production-side validation still runs again after handoff.

## P5 — Registry / release

Order matters:

1. Merge v0.3 public repo.
2. Create/verify npm organization scope `@crafthinkera`.
3. `npm pack --dry-run` and inspect contents.
4. `npm publish --access public` (initial publish).
5. Verify from a clean directory: `npx -y @crafthinkera/mcp doctor`.
6. Update/validate `server.json` against the MCP Registry publisher.
7. Publish `com.crafthinkera/crafty-mcp` to the official MCP Registry.
8. Later configure npm trusted publishing from GitHub Actions for tagged releases.
