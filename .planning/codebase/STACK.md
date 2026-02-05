# Technology Stack

**Analysis Date:** 2026-02-05

## Languages

**Primary:**
- TypeScript 5.4+ - Core application language with strict mode enabled

**Secondary:**
- JavaScript (ES2022) - Target output language for Node.js runtime

## Runtime

**Environment:**
- Node.js 20.0.0 or higher (specified in `package.json` engines field)

**Package Manager:**
- npm - Version management through `package.json`
- Lockfile: Present (implied by npm usage)

## Frameworks

**Core:**
- @modelcontextprotocol/sdk ^1.0.0 - MCP server framework for Claude Code and Claude Desktop integration
  - Location: Imported in `src/index.ts` for Server and StdioServerTransport
  - Purpose: Provides server infrastructure, tool definitions, and request/response handling

**Testing:**
- Vitest ^1.6.0 - Test runner and assertion framework
  - Config: `vitest.config.ts`
  - Features: Global test utilities, coverage with v8 provider
  - Coverage reporters: text, json, html

**Build/Dev:**
- TypeScript ^5.4.0 - Type checking and compilation via `npm run build`
- tsx ^4.0.0 - Runtime execution and watch mode via `npm run dev`

## Key Dependencies

**Critical:**
- @modelcontextprotocol/sdk ^1.0.0 - Required for MCP protocol compliance and server functionality
  - Provides: Server class, StdioServerTransport, request schemas (ListToolsRequestSchema, CallToolRequestSchema)
  - Used in: `src/index.ts`

- zod ^3.23.0 - Schema validation library
  - Location: `src/core/validator.ts`
  - Purpose: Runtime validation of multi_edit and multi_edit_files inputs
  - Provides: EditOperationSchema, MultiEditInputSchema, MultiEditFilesInputSchema
  - Validation functions: validateMultiEditInput(), validateMultiEditFilesInput()

**Standard Library:**
- fs/promises - Node.js file system API
  - Location: `src/core/editor.ts`
  - Purpose: Asynchronous file reading/writing for edit operations

## Configuration

**Environment:**
- Development: Uses `.venv` directory (Python virtual environment detected)
- No .env files required - MCP server operates via stdio transport
- Configuration via MCP client (Claude Code or Claude Desktop)

**Build:**
- TypeScript compiler configuration: `tsconfig.json`
  - Compiler options:
    - Target: ES2022
    - Module system: NodeNext (ES modules)
    - Strict mode: true
    - Output: `./dist` directory
    - Source maps: enabled (sourceMap, declarationMap)
    - Type definitions: Generated with declaration files

- Test configuration: `vitest.config.ts`
  - Globals enabled for test functions (describe, it, expect)
  - Coverage provider: v8
  - Reporters: text, json, html
  - Exclusions: node_modules/, dist/, tests/

## Platform Requirements

**Development:**
- Node.js 20.0.0+
- npm (or compatible package manager)
- TypeScript support (type checking in IDE recommended)
- Unix-like environment (script uses #!/usr/bin/env node shebang)

**Production:**
- Deployment target: Node.js 20.0.0+ environments
- Execution: CLI command `mcp-multi-edit` (via bin entry point in `package.json`)
- Transport: stdio-based (no network dependencies)
- Operating systems: macOS (primary), Linux, Windows with Node.js

## Binary Entry Point

- CLI command: `mcp-multi-edit`
- Points to: `dist/index.js`
- Execution: `node dist/index.js`
- Use case: Integration with Claude Desktop config or direct CLI invocation

## MCP Configuration

- MCP Server name: `eais-mcp-multi-edit`
- Version: 1.0.0
- Tools exposed: 2 (multi_edit, multi_edit_files)
- Transport: Stdio (standard input/output)
- Capabilities: tools (both tool listing and execution)

---

*Stack analysis: 2026-02-05*
