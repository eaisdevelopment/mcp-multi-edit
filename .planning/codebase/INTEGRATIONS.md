# External Integrations

**Analysis Date:** 2026-02-05

## APIs & External Services

**Model Context Protocol (MCP):**
- Claude Code - MCP client that discovers and executes tools
  - Integration: Tools exposed as `mcp__eais-multi-edit__multi_edit` and `mcp__eais-multi-edit__multi_edit_files`
  - SDK: @modelcontextprotocol/sdk ^1.0.0
  - Location: `src/index.ts`

- Claude Desktop - MCP client for local tool integration
  - Configuration: Installed via npm, added to `claude_desktop_config.json`
  - Command: `npx -y @anthropic-community/eais-mcp-multi-edit`
  - Transport: stdio-based communication

**Tool Communication:**
- Request types: ListToolsRequest, CallToolRequest
  - Handlers in `src/index.ts`:
    - ListToolsRequestSchema → returns TOOLS array
    - CallToolRequestSchema → dispatches to multi_edit or multi_edit_files handlers
  - Response format: JSON with text content and error flag

## Data Storage

**File System:**
- Local filesystem only
- Client: Node.js `fs/promises` API
- Operations:
  - Read: File content reading for analysis before edits
  - Write: File content writing after successful edits
  - Backup: Optional .bak files (create_backup parameter)

**Databases:**
- None - This is a stateless MCP server

**File Storage:**
- Local filesystem only
- No cloud storage integrations
- Backup location: Same directory as target file with .bak extension

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- None required
- Authentication handled by MCP transport (stdio)
- Access control: Inherited from host application (Claude Code/Claude Desktop)

**Identity:**
- MCP server identifies as: `eais-mcp-multi-edit` version 1.0.0
- No API keys or credentials required

## Monitoring & Observability

**Error Tracking:**
- None (no external error tracking service)
- Errors reported in MCP responses with isError flag

**Logs:**
- stderr: Server status messages
  - Message: "EAIS MCP Multi-Edit Server running on stdio"
  - Location: `src/index.ts` line 189
- No structured logging framework
- Error logging: Via catch block in request handler (line 182)

**Debugging:**
- console.error() for startup messages
- Error messages in MCP response payloads
- No debug-level logging configured

## CI/CD & Deployment

**Hosting:**
- npm registry (public)
  - Package name: @anthropic-community/eais-mcp-multi-edit
  - Distribution: npm install -g or npx

**CI Pipeline:**
- None detected (no GitHub Actions, GitLab CI, etc.)

**Build Process:**
- Local builds via npm scripts:
  - `npm run build` - TypeScript compilation to dist/
  - `npm run test` - Vitest test execution
  - `prepublishOnly` hook - Runs build and test before npm publish

**Deployment Mechanism:**
- npm publish (manual)
- Pre-publish validation: build + test (via prepublishOnly)

## Environment Configuration

**Required env vars:**
- None - Server requires no environment variables

**Optional configurations:**
- MCP client configuration (external):
  - Claude Desktop: `~/.config/Claude/claude_desktop_config.json` (platform-specific path)
  - Claude Code: Automatic tool discovery

**Secrets location:**
- Not applicable - No secrets needed

## Webhooks & Callbacks

**Incoming:**
- None - Server does not expose HTTP endpoints
- All communication via stdio transport

**Outgoing:**
- None - Server does not make outbound requests
- One-way communication: receive request, send response

## Package Distribution

**npm Details:**
- Package: @anthropic-community/eais-mcp-multi-edit
- License: MIT
- Repository: https://github.com/anthropic-community/eais-mcp-multi-edit
- Keywords: mcp, claude, multi-edit, file-editing, anthropic

**Installation Methods:**
1. Global install: `npm install -g @anthropic-community/eais-mcp-multi-edit`
2. NPX (no install): `npx -y @anthropic-community/eais-mcp-multi-edit`
3. Local install: `npm install @anthropic-community/eais-mcp-multi-edit`

## Integration Points with Claude

**Tool Registration:**
- Tools defined in `src/index.ts` lines 32-124
- Each tool has name, description, and inputSchema (JSON Schema format)

**Tool: multi_edit**
- Single-file atomic editing
- Parameters: file_path (string), edits (array), dry_run (bool), create_backup (bool)
- Returns: MultiEditResult with success status, files edited, and per-edit results

**Tool: multi_edit_files**
- Multi-file coordinated editing
- Parameters: files (array of {file_path, edits}), dry_run (bool), create_backup (bool)
- Returns: MultiEditFilesResult with overall success and per-file results

## Communication Protocol

**Transport:**
- stdio (standard input/output)
- Class: StdioServerTransport from @modelcontextprotocol/sdk
- Connection: `server.connect(transport)` in main() function

**Message Format:**
- JSON-RPC style requests/responses
- Request handler pattern:
  - Receive: {name: string, arguments: unknown}
  - Send: {content: [{type: 'text', text: string}], isError: boolean}

---

*Integration audit: 2026-02-05*
