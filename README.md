<!-- mcp-name: com.crafthinkera/crafty-mcp -->

# Crafty MCP

Give an agent tools for the part between **"make this"** and a real physical object.

The default runtime is local and BYOK. Your Gemini and Meshy keys stay on your machine and go only to those providers. A CrafThinkERA token is optional until you want to cross into hosted/network operations.

```text
intent
  |
  v
local project
  |
  +--> Gemini (your key) -> concept -> separate reference views
  |
  +--> Meshy  (your key) -> GLB
  |
  v
physical handoff
  |
  v
CrafThinkERA -> quote -> human approval -> payment -> production
```

Crafty is not another model. The open-source runtime handles the client edge, local project state, provider adapters and public artifact contracts. CrafThinkERA keeps routing intelligence, commercial state, maker operations and production execution private.

## Run it

Once the package is published:

```bash
npx -y @crafthinkera/mcp doctor
```

Use your own provider keys:

```bash
export GEMINI_API_KEY="..."
export MESHY_API_KEY="..."

npx -y @crafthinkera/mcp
```

The process speaks MCP over stdio, so normally an MCP host launches it for you. `doctor` is the human-readable sanity check. For Codex, use `examples/codex.byok.toml`; it forwards the key *names* from your local environment instead of writing secret values into config.

For example, a stdio host can run:

```json
{
  "mcpServers": {
    "crafty": {
      "command": "npx",
      "args": ["-y", "@crafthinkera/mcp"],
      "env": {
        "GEMINI_API_KEY": "${GEMINI_API_KEY}",
        "MESHY_API_KEY": "${MESHY_API_KEY}"
      }
    }
  }
}
```

## Local tools

The v0.3 local runtime exposes:

- `crafty_status` — provider readiness, never secret values.
- `start_project` — durable local project state under `~/.crafthinkera`.
- `inspect_project` — artifacts, checksums and provider jobs.
- `generate_concept` — one canonical image through your Gemini key.
- `generate_reference_views` — four **separate** identity-consistent views; never a contact sheet.
- `generate_geometry` — start Meshy image-to-3D with your Meshy key.
- `check_geometry` — poll once and save the GLB locally when ready.
- `check_crafthinkera_connection` — optional read-only check of a hosted bearer token.

Do not hardcode this list in an agent. Use MCP `tools/list` at runtime.

## Why separate views matter

The geometry input contract is intentionally boring:

```text
front.jpg
left.jpg
back.jpg
right.jpg
```

Each file contains exactly one view of the same object. A contact sheet can make a 3D model interpret the sheet as a scene containing several objects. Crafty never feeds a contact sheet into Meshy.

Meshy's API accepts base64 Data URIs, so the local runtime does not need to upload your reference images to CrafThinkERA or a public bucket before geometry generation.

## CrafThinkERA network

Local BYOK does not require `CRAFTHINKERA_MCP_TOKEN`.

When you have a token, you can verify the hosted MCP connection with `check_crafthinkera_connection`. The existing hosted endpoint remains:

```text
https://www.crafthinkera.com/api/mcp
```

The final **local-artifact -> CrafThinkERA quote** import contract is deliberately not faked in v0.3. The hosted commercial Core currently quotes assets already stored inside a CrafThinkERA project. The next network milestone is a content-addressed handoff/upload flow that imports a local manifest + asset hashes, revalidates the files server-side, and only then allows quoting.

That boundary matters: a locally generated GLB is not automatically production-ready.

## Hosted bridge compatibility

If you explicitly want the old thin bridge behavior:

```bash
export CRAFTHINKERA_MCP_TOKEN="ctk_..."
npx -y @crafthinkera/mcp --remote
```

In default mode the token is optional.

## Security model

Provider keys are read from environment variables and are never returned by MCP tools or written into project manifests. Local projects use generated IDs and generated filenames; project IDs and asset filenames are validated before filesystem access. Meshy output downloads are restricted to HTTPS Meshy asset hosts.

Physical side effects stay behind CrafThinkERA's private Core. Quote, approval, payment and production are not inferred from local provider success.

## Open / private boundary

Open here:

```text
MCP runtime + transport
BYOK provider adapters
local project/artifact format
public tool schemas
client examples
connection diagnostics
```

Private in CrafThinkERA:

```text
provider/routing policy
cost + quality policy
commercial state
maker selection
production operations
customer data
```

The split is intentional.

## Development

```bash
git clone https://github.com/crafthinkera/mcp.git
cd mcp
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Localhost is only for developing the hosted bridge itself; ordinary BYOK users do not need to run a CrafThinkERA web server.

## Discovery

```text
Repo      https://github.com/crafthinkera/mcp
Remote    https://www.crafthinkera.com/api/mcp
Discovery https://www.crafthinkera.com/.well-known/mcp.json
Skill     https://www.crafthinkera.com/skills/crafthinkera/SKILL.md
LLMs      https://www.crafthinkera.com/llms.txt
```

Registry identity: `com.crafthinkera/crafty-mcp`.

## License

MIT
