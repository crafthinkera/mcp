# Authentication

Every request to CrafThinkERA carries an `Authorization: Bearer` token. Tokens
identify an agent principal, its accountable human owner, and its granted
scopes. They are not npm credentials and must never be committed.

An operator creates and revokes principals in the private CrafThinkERA service.
The package only forwards the token to the remote MCP endpoint.

Use a token with the smallest suitable scope:

- `project:create` starts a project.
- `project:read` reads a project, review feedback, execution plans, and cases.
- `work:run` advances work that does not spend paid provider credit.
- `work:run:paid` permits a paid provider step when the service allows it.

The service enforces project ownership and human review. Possessing a token does
not allow an agent to choose a production route, approve production, or close a
physical-production case.
