# Phase 9: Integration Testing - Research

**Researched:** 2026-02-09
**Domain:** MCP server integration testing with real filesystem and in-process client/server
**Confidence:** HIGH

## Summary

Phase 9 requires integration tests that verify the complete MCP request/response cycle for both `multi_edit` and `multi_edit_files` tools, plus edge case coverage (unicode, large files, empty edits). The project currently has a placeholder `tests/integration/server.test.ts` with only `.todo` stubs and no actual test logic.

The primary technical challenge is that `src/index.ts` creates the MCP `Server` instance inline and does not export it. For true end-to-end MCP protocol testing (Client <-> Server via transport), the server setup must be extracted into a reusable factory function. The MCP SDK v1.26.0 (installed) provides `InMemoryTransport.createLinkedPair()` which creates two linked transports -- one for a `Client` and one for a `Server` -- enabling in-process integration testing without stdio or HTTP. This is the standard approach for MCP server integration testing.

Two levels of integration testing are needed: (1) **MCP protocol-level tests** using `Client` + `InMemoryTransport` to verify the full request/response cycle including tool discovery (`listTools`) and tool invocation (`callTool`), and (2) **handler-level tests** calling `handleMultiEdit()` and `handleMultiEditFiles()` directly with real filesystem operations in temp directories. Both levels must use the REAL filesystem (not memfs) as required by success criteria #3. The handler-level tests already have exported functions (`handleMultiEdit`, `handleMultiEditFiles`) that accept `unknown` args and return MCP response objects, making them straightforward to test.

**Primary recommendation:** Split into two plans: (1) MCP protocol integration tests (refactor server creation, test via Client + InMemoryTransport), and (2) edge case tests with real filesystem operations (unicode, large files, empty edits, permission errors).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^1.6.0 (installed: 1.6.1) | Test runner | Already in project, ESM-native |
| @modelcontextprotocol/sdk | ^1.0.0 (installed: 1.26.0) | MCP Client + InMemoryTransport | SDK's own testing primitive |
| node:fs/promises | Node 20 built-in | Real filesystem temp operations | Integration tests require real fs per success criteria |
| node:os | Node 20 built-in | `os.tmpdir()` for temp directories | Standard Node.js temp dir location |
| node:path | Node 20 built-in | Path manipulation | Already used throughout project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitest/coverage-v8 | ^1.6.0 (installed) | Coverage reporting | Already configured in vitest.config.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| InMemoryTransport | StdioClientTransport + child_process | Much slower (process spawn per test), harder to debug, but tests actual stdio path |
| Real temp dirs | memfs | Phase 8 used memfs for unit tests; Phase 9 explicitly requires real filesystem |
| Direct handler calls | Full MCP Client flow only | Handlers are simpler to call but skip MCP protocol layer (JSON-RPC, schema, initialization) |

**Installation:**
```bash
# No new dependencies needed. All libraries are already installed.
```

## Architecture Patterns

### Recommended Test Structure
```
tests/
  integration/
    server.test.ts          # EXISTING - replace todos with MCP protocol tests
    edge-cases.test.ts      # NEW - unicode, large files, empty edits, permissions
    helpers/
      setup.ts              # NEW - createTestServer(), createTempFile(), cleanup helpers
src/
  server.ts                 # NEW - extracted server factory (createServer function)
  index.ts                  # MODIFIED - imports createServer from server.ts
```

### Pattern 1: Server Factory Extraction
**What:** Extract the MCP Server creation from `index.ts` into a separate `server.ts` module that exports a `createServer()` function. The entry point `index.ts` then imports this and connects it to StdioServerTransport.
**When to use:** Required for any test that needs to exercise the full MCP protocol (listTools, callTool via Client).
**Why:** The current `index.ts` creates the server, sets up handlers, and starts listening -- all inline. Without extraction, there is no way to get a `Server` instance to connect to an `InMemoryTransport` in tests.

```typescript
// src/server.ts - Extracted server factory
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { handleMultiEdit } from './tools/multi-edit.js';
import { handleMultiEditFiles } from './tools/multi-edit-files.js';
import { createErrorEnvelope, classifyError } from './core/errors.js';

const TOOLS = [ /* ... tool definitions ... */ ];

export function createServer(): Server {
  const server = new Server(
    { name: 'eais-mcp-multi-edit', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // ... same handler logic as current index.ts ...
  });

  return server;
}
```

```typescript
// src/index.ts - Simplified entry point
#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

const server = createServer();

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('EAIS MCP Multi-Edit Server running on stdio');
}

main().catch(console.error);
```

### Pattern 2: InMemoryTransport Integration Test Setup
**What:** Create linked Client + Server instances in-process for testing.
**When to use:** Every MCP protocol-level integration test.

```typescript
// Source: @modelcontextprotocol/sdk InMemoryTransport API (verified from installed SDK d.ts)
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../src/server.js';

async function createTestClient(): Promise<Client> {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    {}
  );
  await client.connect(clientTransport);

  return client;
}

// Usage in tests:
const client = await createTestClient();

// List tools
const { tools } = await client.listTools();
expect(tools).toHaveLength(2);
expect(tools.map(t => t.name)).toContain('multi_edit');

// Call a tool
const result = await client.callTool({
  name: 'multi_edit',
  arguments: {
    file_path: '/tmp/test-file.txt',
    edits: [{ old_string: 'hello', new_string: 'world' }],
  },
});
// result.content is an array of { type: 'text', text: string }
// result.isError is boolean
```

### Pattern 3: Real Filesystem Temp Directory Management
**What:** Create isolated temp directories for each test, write fixture files, clean up after.
**When to use:** All integration tests (real fs required by success criteria).

```typescript
// Source: Node.js fs/promises API
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'mcp-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// Create test files:
const filePath = join(tempDir, 'test.txt');
await writeFile(filePath, 'hello world', 'utf-8');

// After edit, verify:
const content = await readFile(filePath, 'utf-8');
expect(content).toBe('hello there');
```

### Pattern 4: Handler-Level Direct Testing
**What:** Call `handleMultiEdit()` or `handleMultiEditFiles()` directly with real filesystem paths.
**When to use:** Testing tool-specific behavior without MCP protocol overhead. Good for edge case testing.

```typescript
import { handleMultiEdit } from '../../src/tools/multi-edit.js';

const result = await handleMultiEdit({
  file_path: join(tempDir, 'test.txt'),
  edits: [{ old_string: 'hello', new_string: 'world' }],
});

expect(result.isError).toBeFalsy();
const parsed = JSON.parse(result.content[0].text);
expect(parsed.success).toBe(true);
```

### Anti-Patterns to Avoid
- **Testing with memfs in integration tests:** Phase 9 explicitly requires real filesystem operations. Use `mkdtemp` + real temp dirs, not `vol.fromJSON`.
- **Sharing temp directories between tests:** Each test must have its own isolated temp dir. Never reuse `tempDir` across tests.
- **Not cleaning up temp files:** Always use `afterEach` with `rm(tempDir, { recursive: true, force: true })`. Failing to clean up fills `/tmp` on CI.
- **Parsing MCP response text without error handling:** The `content[0].text` is a JSON string. Always `JSON.parse` it and check `isError` on the outer result PLUS `success` in the parsed body.
- **Hardcoding absolute paths:** Always use `join(tempDir, 'filename')` to build paths. Never use `/tmp/test.txt` directly.
- **Testing server startup behavior in unit-like way:** Integration tests should focus on tool behavior through the protocol, not on internal server wiring.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP client for testing | Custom JSON-RPC message builder | `Client` from `@modelcontextprotocol/sdk/client/index.js` | Full protocol compliance: initialization, capability negotiation, schema validation |
| In-process transport | Custom event emitter pair | `InMemoryTransport.createLinkedPair()` | Already provided by SDK, handles message queueing and lifecycle |
| Temp file management | Global `/tmp/test-*` paths | `mkdtemp(join(tmpdir(), 'mcp-test-'))` per test | OS-portable, isolated, guaranteed unique |
| JSON-RPC framing | Manual `{ jsonrpc: "2.0", method: ... }` | SDK Client methods (`listTools`, `callTool`) | Handles request IDs, response matching, error propagation |

**Key insight:** The MCP SDK provides both the server-side and client-side infrastructure. Using `Client` + `InMemoryTransport` is the canonical way to test MCP servers in-process -- it validates the full protocol contract, not just handler logic.

## Common Pitfalls

### Pitfall 1: Server Not Exported for Testing
**What goes wrong:** Attempting to import the server from `index.ts` fails because `index.ts` creates the server inline, starts it, and does not export it. There is no `createServer()` function.
**Why it happens:** `index.ts` was written as an entry point, not a reusable module.
**How to avoid:** Extract server creation into `src/server.ts` with a `createServer()` export. Modify `index.ts` to import from `server.ts`. This is a small refactor with no behavioral change.
**Warning signs:** Test file tries to `import { server } from '../../src/index.js'` and gets `undefined`.

### Pitfall 2: InMemoryTransport Requires Both connect() Calls
**What goes wrong:** Creating the transport pair but only connecting one side (e.g., forgetting `client.connect(clientTransport)`) causes silent message drops or hangs.
**Why it happens:** Both `server.connect(serverTransport)` and `client.connect(clientTransport)` must be called. The `client.connect()` also triggers the MCP initialization handshake.
**How to avoid:** Always connect both sides in the test setup. The `client.connect()` call should come AFTER `server.connect()` because the client initiates the `initialize` request which the server must be ready to handle.
**Warning signs:** Tests hang indefinitely or timeout. Client methods throw "Not connected" errors.

### Pitfall 3: callTool Response Shape
**What goes wrong:** Assuming `callTool` returns the JSON body directly. It actually returns `{ content: [{type: 'text', text: '...'}], isError?: boolean }`. The `text` field contains a JSON-stringified response that must be parsed.
**Why it happens:** MCP protocol wraps tool results in content blocks.
**How to avoid:** Always access `result.content[0].text` and `JSON.parse()` it. Check `result.isError` for protocol-level errors. Check `parsed.success` for tool-level success.
**Warning signs:** Tests fail with "Cannot read property 'success' of undefined" because the response object shape doesn't match expectations.

### Pitfall 4: Validator Resolves Symlinks via fs.realpath
**What goes wrong:** The validator calls `fs.realpath()` on file paths, which resolves symlinks. On macOS, `/tmp` is a symlink to `/private/tmp`. So a file created at `/tmp/mcp-test-abc/file.txt` will be resolved to `/private/tmp/mcp-test-abc/file.txt` by the validator. If tests compare `file_path` in the response against the original `/tmp/...` path, assertions fail.
**Why it happens:** macOS `/tmp` -> `/private/tmp` symlink resolution.
**How to avoid:** Use `fs.realpath(tempDir)` after `mkdtemp` to get the resolved path, OR use `os.tmpdir()` which may already return the resolved path on some systems. Alternatively, use `await fs.realpath(tempDir)` to normalize the path before writing tests.
**Warning signs:** Tests pass on Linux CI but fail on macOS (or vice versa). Response `file_path` does not match the path used to create the file.

### Pitfall 5: Backup Files (.bak) Left in Temp Directory
**What goes wrong:** After a successful edit, `.bak` files remain in the temp directory. Tests that check directory contents may find unexpected files.
**Why it happens:** `multi_edit` creates `.bak` files by default (`backup: true`). `multi_edit_files` always creates `.bak` files.
**How to avoid:** Either (a) pass `backup: false` in tests where backup behavior is not being tested, or (b) account for `.bak` files in assertions. The `afterEach` cleanup handles the temp dir regardless.
**Warning signs:** Assertions like "directory should have exactly 1 file" fail because `.bak` exists.

### Pitfall 6: File Permission Tests on CI
**What goes wrong:** Tests that check permission-denied errors by `chmod 000` may fail on CI runners that run as root (root can read/write any file regardless of permissions).
**Why it happens:** Docker-based CI often runs as UID 0 (root).
**How to avoid:** Skip permission tests when `process.getuid?.() === 0`. Use `describe.skipIf(process.getuid?.() === 0)` or a similar guard.
**Warning signs:** Permission tests pass locally but fail on CI.

### Pitfall 7: Race Conditions in Multi-File Rollback Tests
**What goes wrong:** Tests verifying rollback behavior assume synchronous file writes, but `atomicWrite` uses temp-file-then-rename which is async.
**Why it happens:** File operations are inherently async and may not complete in the expected order.
**How to avoid:** After calling the handler, always await the result fully before reading files to verify state. Don't read files in parallel with the tool execution.
**Warning signs:** Intermittent test failures where file content is stale or a temp file is found.

## Code Examples

Verified patterns from the installed SDK and project source:

### Test Setup Helper Module
```typescript
// tests/integration/helpers/setup.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from '../../../src/server.js';

/**
 * Create a connected MCP client for integration testing.
 * Returns the client and a cleanup function.
 */
export async function createTestClient(): Promise<{
  client: Client;
  cleanup: () => Promise<void>;
}> {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  const client = new Client(
    { name: 'integration-test-client', version: '1.0.0' },
    {}
  );
  await client.connect(clientTransport);

  return {
    client,
    cleanup: async () => {
      await clientTransport.close();
      // serverTransport closes automatically when client closes (linked pair)
    },
  };
}

/**
 * Create a temporary directory with resolved path.
 * On macOS, /tmp -> /private/tmp symlink is resolved.
 */
export async function createTempDir(): Promise<string> {
  const raw = await mkdtemp(join(tmpdir(), 'mcp-integ-'));
  return await realpath(raw);
}

/**
 * Create a test file with content in the given directory.
 */
export async function createTestFile(
  dir: string,
  name: string,
  content: string
): Promise<string> {
  const filePath = join(dir, name);
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Clean up a temporary directory.
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
```

### MCP Protocol-Level Integration Test
```typescript
// tests/integration/server.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  createTestClient,
  createTempDir,
  createTestFile,
  cleanupTempDir,
} from './helpers/setup.js';

describe('MCP Server Integration', () => {
  let client: Client;
  let cleanup: () => Promise<void>;
  let tempDir: string;

  beforeEach(async () => {
    ({ client, cleanup } = await createTestClient());
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanup();
    await cleanupTempDir(tempDir);
  });

  describe('tool discovery', () => {
    it('should list both tools', async () => {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(2);
      const names = tools.map(t => t.name);
      expect(names).toContain('multi_edit');
      expect(names).toContain('multi_edit_files');
    });

    it('should expose correct input schema for multi_edit', async () => {
      const { tools } = await client.listTools();
      const multiEdit = tools.find(t => t.name === 'multi_edit')!;
      expect(multiEdit.inputSchema.required).toContain('file_path');
      expect(multiEdit.inputSchema.required).toContain('edits');
    });
  });

  describe('multi_edit tool', () => {
    it('should apply single edit and modify file on disk', async () => {
      const filePath = await createTestFile(tempDir, 'test.txt', 'hello world');

      const result = await client.callTool({
        name: 'multi_edit',
        arguments: {
          file_path: filePath,
          edits: [{ old_string: 'hello', new_string: 'goodbye' }],
          backup: false,
        },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse((result.content as Array<{type: string; text: string}>)[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.edits_applied).toBe(1);

      // Verify file was actually modified on disk
      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('goodbye world');
    });
  });
});
```

### Edge Case: Unicode Content
```typescript
it('should handle unicode content correctly', async () => {
  const unicodeContent = 'const greeting = "Hello, \u4e16\u754c!";  // \u4e2d\u6587\nconst emoji = "\ud83d\ude80\ud83c\udf1f";  // Emoji\nconst accent = "caf\u00e9 na\u00efve";  // Accented';
  const filePath = await createTestFile(tempDir, 'unicode.ts', unicodeContent);

  const result = await handleMultiEdit({
    file_path: filePath,
    edits: [{ old_string: 'Hello, \u4e16\u754c!', new_string: '\u3053\u3093\u306b\u3061\u306f\u4e16\u754c!' }],
    backup: false,
  });

  expect(result.isError).toBeFalsy();
  const content = await readFile(filePath, 'utf-8');
  expect(content).toContain('\u3053\u3093\u306b\u3061\u306f\u4e16\u754c!');
  // Verify other unicode content is preserved
  expect(content).toContain('\ud83d\ude80\ud83c\udf1f');
  expect(content).toContain('caf\u00e9 na\u00efve');
});
```

### Edge Case: Large File
```typescript
it('should handle large files (1MB+)', async () => {
  // Generate ~1MB file with repeated lines
  const lines = Array.from({ length: 20000 }, (_, i) =>
    `line ${i + 1}: ${'x'.repeat(50)}`
  );
  const largeContent = lines.join('\n');
  const filePath = await createTestFile(tempDir, 'large.txt', largeContent);

  const result = await handleMultiEdit({
    file_path: filePath,
    edits: [{ old_string: 'line 10000:', new_string: 'REPLACED LINE 10000:' }],
    backup: false,
  });

  expect(result.isError).toBeFalsy();
  const content = await readFile(filePath, 'utf-8');
  expect(content).toContain('REPLACED LINE 10000:');
  // Verify file size is roughly the same (replacement is slightly longer)
  expect(content.length).toBeGreaterThan(1_000_000);
});
```

### Edge Case: Empty Edits Array
```typescript
it('should handle empty edits array gracefully', async () => {
  const filePath = await createTestFile(tempDir, 'empty-edits.txt', 'unchanged content');

  // Note: The Zod schema requires minItems: 1 on edits array
  // So this should fail validation, NOT succeed with 0 edits
  const result = await handleMultiEdit({
    file_path: filePath,
    edits: [],
    backup: false,
  });

  expect(result.isError).toBe(true);
  const parsed = JSON.parse(result.content[0].text);
  expect(parsed.error_code).toBe('VALIDATION_FAILED');

  // Verify file was not modified
  const content = await readFile(filePath, 'utf-8');
  expect(content).toBe('unchanged content');
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stdio-based integration tests (spawn child process) | InMemoryTransport in-process testing | MCP SDK 1.x+ | 100x faster, no process spawn, deterministic |
| Low-level `Server` class | `Server` (low-level, used in this project) vs `McpServer` (high-level) | MCP SDK 1.x | Project uses low-level `Server` -- tests must match this pattern |
| Manual JSON-RPC message construction | `Client.callTool()` / `Client.listTools()` | MCP SDK 1.x | Type-safe, handles protocol automatically |

**Deprecated/outdated:**
- Using `StdioClientTransport` with `child_process.spawn` for integration tests is valid but slow and hard to debug. `InMemoryTransport` is preferred.
- The `Server` class is marked `@deprecated` in SDK docs in favor of `McpServer`, but the project already uses `Server` extensively. No need to migrate for testing purposes -- just test what exists.

## Refactoring Requirements

### Required: Extract Server Factory
**Current state:** `src/index.ts` creates and runs the server inline (lines 19-180).
**Required change:** Move server creation logic into `src/server.ts`, export `createServer()`.
**Risk:** LOW -- purely structural refactoring, no behavioral change.
**Scope:** Move ~150 lines of server setup from `index.ts` to `server.ts`. `index.ts` becomes ~10 lines.
**Impact on other phases:** None. `index.ts` entry point behavior is unchanged. All tool definitions and handler registrations stay the same.

## Test Inventory

### MCP Protocol Integration Tests (server.test.ts)
| Test | What It Verifies | Priority |
|------|-----------------|----------|
| List both tools | `listTools` returns multi_edit and multi_edit_files | HIGH |
| Tool schema correctness | Input schemas have correct required fields | HIGH |
| Single edit via callTool | Full request/response cycle for basic edit | HIGH |
| Multiple edits via callTool | Sequential edits applied atomically | HIGH |
| Dry-run via callTool | Edits previewed, file unchanged | HIGH |
| Backup creation via callTool | .bak file created with original content | MEDIUM |
| Error response for non-existent file | Returns isError: true with FILE_NOT_FOUND | HIGH |
| Error response for match not found | Returns MATCH_NOT_FOUND with context | HIGH |
| Unknown tool name | Returns UNKNOWN_TOOL error | MEDIUM |
| multi_edit_files basic flow | Multiple files edited successfully | HIGH |
| multi_edit_files rollback | First file restored when second file fails | HIGH |
| multi_edit_files dry-run | All files previewed, none modified | HIGH |

### Edge Case Tests (edge-cases.test.ts)
| Test | What It Verifies | Priority |
|------|-----------------|----------|
| Unicode content (CJK, emoji, accented chars) | Correct handling of multi-byte characters | HIGH |
| Large file (~1MB) | Performance and correctness at scale | HIGH |
| Empty edits array | Validation rejects with VALIDATION_FAILED | HIGH |
| File with only whitespace | Edits work on whitespace-only content | MEDIUM |
| File with Windows line endings (CRLF) | \r\n preserved correctly | MEDIUM |
| File with mixed line endings | Handles mixed \n and \r\n | LOW |
| Very long single line | No line-length-related failures | MEDIUM |
| Edit that produces empty file | Replacing all content with empty string | MEDIUM |
| Concurrent edits to different files | No interference between parallel multi_edit_files calls | LOW |
| Binary-like content (null bytes) | Invalid UTF-8 rejected with INVALID_ENCODING | MEDIUM |
| Path with spaces | Paths containing spaces handled correctly | MEDIUM |
| Deeply nested path | `/a/b/c/d/e/f/g/file.txt` works | LOW |
| Replace with same string (no-op) | File unchanged, success response | MEDIUM |
| Replace all flag | All occurrences replaced | HIGH |
| Ambiguous match (multiple matches without replace_all) | Error with AMBIGUOUS_MATCH code and locations | HIGH |

## Open Questions

1. **Server refactoring scope**
   - What we know: `src/index.ts` must be split into `src/server.ts` (factory) + `src/index.ts` (entry point) for testability.
   - What's unclear: Whether this refactoring should be its own plan step or part of the test setup step.
   - Recommendation: Make it the first step in the first plan. It is a prerequisite for all MCP protocol-level tests. The change is small and low-risk.

2. **Client.callTool return type complexity**
   - What we know: The SDK's `callTool` return type is a union type that can be `{ content: ..., isError?: boolean }` or `{ toolResult: ... }`. Our server returns the `content` variant.
   - What's unclear: Whether TypeScript narrowing will require type assertions in tests.
   - Recommendation: Use type assertions like `(result.content as Array<{type: string; text: string}>)[0].text` or create a helper function that extracts and parses the text content.

3. **Test timeout for large file tests**
   - What we know: The default Vitest timeout is 5000ms. Large file tests with real disk I/O may exceed this.
   - What's unclear: Exact performance characteristics on CI.
   - Recommendation: Set `{ timeout: 10000 }` on large file test blocks as a safety margin.

## Sources

### Primary (HIGH confidence)
- Installed MCP SDK v1.26.0 type declarations: `node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.d.ts` -- verified `InMemoryTransport.createLinkedPair()` API
- Installed MCP SDK v1.26.0 type declarations: `node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.d.ts` -- verified `Client.listTools()`, `Client.callTool()` APIs
- Installed MCP SDK v1.26.0 implementation: `node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js` -- verified createLinkedPair creates two linked transports
- Project source code: `src/index.ts`, `src/tools/multi-edit.ts`, `src/tools/multi-edit-files.ts`, `src/core/editor.ts`, `src/core/validator.ts`, `src/core/reporter.ts`, `src/core/errors.ts`, `src/types/index.ts`
- Existing tests: `tests/integration/server.test.ts` (placeholder), `tests/unit/editor-io.test.ts` (Phase 8 memfs pattern)
- Phase 8 research: `.planning/phases/08-unit-testing/08-RESEARCH.md`

### Secondary (MEDIUM confidence)
- [MCP TypeScript SDK GitHub repository](https://github.com/modelcontextprotocol/typescript-sdk) -- InMemoryTransport is part of the official testing infrastructure
- [MCP TypeScript SDK npm page](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- version 1.26.0 confirmed

### Tertiary (LOW confidence)
- InMemoryTransport usage in third-party MCP servers -- not directly verified, pattern inferred from SDK API surface

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed, APIs verified from type declarations
- Architecture: HIGH -- server factory extraction is a well-understood refactoring; InMemoryTransport API is simple
- Test patterns: HIGH -- `Client.callTool()` and `Client.listTools()` verified from SDK types; real filesystem temp dir patterns are standard Node.js
- Pitfalls: HIGH -- macOS /tmp symlink, callTool response shape, and permission testing on CI are well-documented issues
- Edge cases: MEDIUM -- test inventory is comprehensive but exact behavior of some edge cases (binary content, CRLF) needs validation during implementation

**Research date:** 2026-02-09
**Valid until:** 2026-03-11 (30 days -- stable technology stack, MCP SDK API unlikely to break)
