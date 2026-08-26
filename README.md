# CrafThinkERA MCP

Give an agent a path from an instruction to a physical-production workflow.

```text
Agent: "I need this object manufactured."
                    |
                    v
             CrafThinkERA MCP
                    |
                    v
 start_project -> inspect_project -> work_on_project
                    |
                    v
 route_production -> prepare_execution
                    |
                    v
             HUMAN APPROVAL
                    |
                    v
          Physical production
```

CrafThinkERA is the private service behind this connector. This package is a
thin MCP bridge: it carries transport, authentication, schemas, validation and
responses between an MCP client and that service. It does not contain routing
intelligence, provider ranking, production thresholds, case memory, customer
data, or execution logic.

```bash
npm install @crafthinkera/mcp
```

## Connect in under five minutes

Ask a CrafThinkERA operator for an agent token. Keep it in an environment
variable, never in a checked-in config file.

### Direct remote HTTP — Claude Code and compatible clients

```bash
export CRAFTHINKERA_MCP_TOKEN=ctk_replace_with_your_token

claude mcp add --transport http crafthinkera \
  https://www.crafthinkera.com/api/mcp \
  --header "Authorization: Bearer $CRAFTHINKERA_MCP_TOKEN"
```

Or place the contents of [examples/claude-code.mcp.json](examples/claude-code.mcp.json)
in `.mcp.json`. This is the preferred connection: no local server process and
no repository clone.

### Codex

```bash
export CRAFTHINKERA_MCP_TOKEN=ctk_replace_with_your_token

codex mcp add crafthinkera \
  --url https://www.crafthinkera.com/api/mcp \
  --bearer-token-env-var CRAFTHINKERA_MCP_TOKEN
```

The equivalent configuration is in [examples/codex.toml](examples/codex.toml).

### Claude Desktop, Cursor, or any stdio MCP consumer

Install nothing globally; `npx` downloads the package when the MCP client starts.
Add this server configuration:

```json
{
  "mcpServers": {
    "crafthinkera": {
      "command": "npx",
      "args": ["-y", "@crafthinkera/mcp"],
      "env": {
        "CRAFTHINKERA_MCP_TOKEN": "ctk_replace_with_your_token"
      }
    }
  }
}
```

The package starts a local stdio bridge, discovers the remote tools for this
token, and forwards calls over HTTPS. See the ready-to-copy
[Claude Desktop](examples/claude-desktop.json) and
[Cursor](examples/cursor.mcp.json) examples.

For a local development service, add `CRAFTHINKERA_MCP_URL`:

```json
"env": {
  "CRAFTHINKERA_MCP_URL": "http://localhost:3001/api/mcp",
  "CRAFTHINKERA_MCP_TOKEN": "ctk_replace_with_your_token"
}
```

HTTP is accepted only for `localhost`; all other endpoints must use HTTPS.

## What an agent actually calls

Start with the user’s physical intent:

```json
{
  "tool": "start_project",
  "arguments": {
    "intent": "Produce a 3D printed replacement enclosure for this device",
    "locale": "en"
  }
}
```

The real response shape is:

```json
{
  "projectId": "req_…",
  "productionStage": "INTAKE",
  "next": "Call work_on_project to have CrafThinkERA interpret it."
}
```

The agent can then call:

| Tool | What it does |
| --- | --- |
| `start_project` | Opens a physical project from an intent. |
| `get_project` / `inspect_project` | Reads its current state or full execution view. |
| `work_on_project` | Advances the next allowed step or answers a blocking question. |
| `prepare_execution` | Shows the capability graph and available providers. |
| `get_review_feedback` | Reads the human review state. |
| `route_production` | Recommends viable physical-production routes for a mesh. |
| `recall_cases` | Reads matching closed cases from CrafThinkERA’s own record. |

Tool availability and scope are discovered from the remote service at startup.
An agent can propose, inspect and advance work. It cannot approve production,
choose a route that commits materials, or sign a case record. Those are human
boundaries enforced by the private service.

## Package API

For a custom MCP host, this package exports `parseConfig`,
`configFromEnvironment`, and `runStdioBridge`. Most users should use the
configuration above instead of importing the package.

## Status

The public package is prepared for the production endpoint. The endpoint must
be deployed and return an authenticated MCP response before publishing this
package. A successful `npm install` alone is not evidence that an agent can
reach CrafThinkERA.

## License

MIT
