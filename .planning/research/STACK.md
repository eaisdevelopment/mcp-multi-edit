# Technology Stack: Atomic File Editing in MCP Servers

**Project:** MCP Multi-Edit Server
**Researched:** 2026-02-05
**Research Focus:** Implementation patterns for atomic multi-edit operations
**Overall Confidence:** HIGH (based on MCP SDK documentation, official Node.js APIs, and community patterns)

---

## Executive Summary

This document provides prescriptive patterns for implementing atomic file editing operations in an MCP server. The core challenge is ensuring atomicity (all edits succeed or none apply) while providing clear error feedback to LLMs. The recommended approach uses **in-memory validation with atomic write-back**, leveraging the `write-file-atomic` library for crash-safe file writes and Vitest with memfs for testing.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @modelcontextprotocol/sdk | ^1.0.0 | MCP server framework | Official SDK, well-documented, supports `registerTool` pattern | HIGH |
| Zod | ^3.23.0 | Input validation | Already in project; integrates cleanly with MCP SDK | HIGH |
| TypeScript | ^5.4.0 | Type safety | Strict mode catches errors at compile time | HIGH |

### File Operations

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js fs/promises | Native | Async file I/O | Built-in, Promise-based, no dependencies | HIGH |
| write-file-atomic | ^6.0.0 | Atomic file writes | Proven library from npm org; temp file + rename pattern | HIGH |

### Testing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vitest | ^1.6.0 | Test runner | Fast, TypeScript-native, good mocking | HIGH |
| memfs | ^4.0.0 | In-memory filesystem | Isolates tests from real filesystem; Vitest-compatible | HIGH |

---

## Atomic Edit Pattern (Core Implementation)

### Pattern: In-Memory Validation + Atomic Write-Back

**Confidence: HIGH** (verified against MCP specification and Node.js best practices)

**Why this pattern:**
- All edits are validated against the same content snapshot before any writes
- If validation fails, no file changes occur
- Single atomic write at the end prevents partial states
- Clear separation between validation and execution phases

**Implementation:**

```typescript
import * as fs from 'fs/promises';
import writeFileAtomic from 'write-file-atomic';
import type { EditOperation, EditResult, MultiEditResult } from '../types/index.js';

export async function applyEdits(
  filePath: string,
  edits: EditOperation[],
  dryRun: boolean = false,
  createBackup: boolean = false
): Promise<MultiEditResult> {
  const results: EditResult[] = [];

  // PHASE 1: Read original content (single read)
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    return {
      success: false,
      file_path: filePath,
      edits_applied: 0,
      results: [],
      error: error instanceof Error
        ? `Failed to read file: ${error.message}`
        : 'Failed to read file: Unknown error',
      dry_run: dryRun,
    };
  }

  // PHASE 2: Validate all edits against content snapshot
  let workingContent = content;
  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    const occurrences = findOccurrences(workingContent, edit.old_string);

    if (occurrences === 0) {
      // Edit validation failed - abort entire operation
      return {
        success: false,
        file_path: filePath,
        edits_applied: 0,
        results: results,
        error: `Edit ${i + 1}: old_string not found in file`,
        failed_edit_index: i,
        dry_run: dryRun,
      };
    }

    // Apply edit to working content for subsequent validation
    const replaced = replaceString(
      workingContent,
      edit.old_string,
      edit.new_string,
      edit.replace_all ?? false
    );

    workingContent = replaced.content;
    results.push({
      old_string: edit.old_string,
      matches: occurrences,
      replaced: replaced.replacedCount,
      success: true,
    });
  }

  // PHASE 3: Write result (unless dry run)
  if (!dryRun) {
    // Optional: Create backup before write
    let backupPath: string | undefined;
    if (createBackup) {
      backupPath = `${filePath}.bak`;
      await fs.copyFile(filePath, backupPath);
    }

    // Atomic write: temp file + rename
    try {
      await writeFileAtomic(filePath, workingContent, { encoding: 'utf-8' });
    } catch (error) {
      return {
        success: false,
        file_path: filePath,
        edits_applied: 0,
        results: [],
        error: error instanceof Error
          ? `Failed to write file: ${error.message}`
          : 'Failed to write file: Unknown error',
        dry_run: dryRun,
        backup_path: backupPath,
      };
    }

    return {
      success: true,
      file_path: filePath,
      edits_applied: edits.length,
      results,
      dry_run: dryRun,
      backup_path: backupPath,
    };
  }

  // Dry run: return what would happen
  return {
    success: true,
    file_path: filePath,
    edits_applied: edits.length,
    results,
    dry_run: true,
  };
}
```

### Why write-file-atomic?

**Confidence: HIGH** (official npm package, 97M+ weekly downloads)

The `write-file-atomic` library implements the industry-standard pattern for atomic file writes:

1. **Write to temp file**: Data goes to `<filename>.<hash>.<pid>` first
2. **fsync**: Ensures data is physically written to disk
3. **Rename**: Atomic at OS level - file appears with correct name or not at all

This prevents:
- Partial writes on crash/power loss
- Corruption from concurrent access
- Data loss from failed writes

**Alternative considered:** Manual temp file + `fs.rename()`
**Why rejected:** `write-file-atomic` handles edge cases (concurrent writes, cleanup of orphaned temps) that are easy to get wrong.

---

## MCP Error Handling Pattern

### Pattern: Tool Execution Errors via isError Flag

**Confidence: HIGH** (verified against [MCP specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/server/tools))

**Critical insight:** MCP has two error categories:
1. **Protocol Errors**: JSON-RPC errors for invalid requests (SDK handles these)
2. **Tool Execution Errors**: Business logic failures returned via `isError: true`

**Why this matters for file editing:**
- File not found, permission denied, validation failures are **tool execution errors**
- They should NOT throw exceptions to the MCP SDK
- They SHOULD return `{ content: [...], isError: true }`

**Implementation:**

```typescript
export async function handleMultiEdit(args: unknown): Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}> {
  // 1. Validate input schema
  const validation = validateMultiEditInput(args);
  if (!validation.success) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Validation failed: ${formatZodErrors(validation.error)}`,
          recovery_hint: 'Check input parameters and retry',
        }),
      }],
      isError: true,
    };
  }

  // 2. Execute operation with try-catch
  try {
    const result = await applyEdits(input.file_path, input.edits, input.dry_run);
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      isError: !result.success,
    };
  } catch (error) {
    // Unexpected errors: log internally, return safe message
    console.error('[multi_edit] Unexpected error:', error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
          recovery_hint: 'An unexpected error occurred. Check file path and permissions.',
        }),
      }],
      isError: true,
    };
  }
}
```

### Error Response Best Practices

**Confidence: HIGH** (verified via [mcpcat.io guide](https://mcpcat.io/guides/error-handling-custom-mcp-servers/) and [alpic.ai analysis](https://alpic.ai/blog/better-mcp-tool-call-error-responses-ai-recover-gracefully))

| Principle | Implementation | Rationale |
|-----------|----------------|-----------|
| Validate early | Check inputs before file operations | Fail fast with clear messages |
| Never expose internals | No stack traces in responses | Security; LLMs don't need them |
| Include recovery hints | Add `recovery_hint` field | Helps LLM retry or request user intervention |
| Structured JSON responses | Always JSON in text content | Parseable by callers |
| Log internally | `console.error` for debugging | Capture details without leaking them |

---

## Testing Strategy

### Pattern: Vitest + memfs for File System Isolation

**Confidence: HIGH** (verified via [Vitest documentation](https://vitest.dev/guide/mocking/file-system) and [community examples](https://kschaul.com/til/2024/06/26/mock-fs-with-vitest-and-memfs/))

**Why memfs:**
- In-memory filesystem simulation
- No real disk I/O = fast tests
- Isolated state per test = no flakiness
- Supports both `fs` and `fs/promises`

**Setup File (tests/setup.ts):**

```typescript
import { vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

// Mock both fs modules
vi.mock('fs', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return { default: memfs.fs, ...memfs.fs };
});

vi.mock('fs/promises', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return { default: memfs.fs.promises, ...memfs.fs.promises };
});

// Reset filesystem before each test
beforeEach(() => {
  vol.reset();
});

afterEach(() => {
  vol.reset();
});
```

**Unit Test Example:**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { vol } from 'memfs';
import { applyEdits } from '../../src/core/editor.js';

describe('applyEdits', () => {
  beforeEach(() => {
    // Set up virtual filesystem for each test
    vol.fromJSON({
      '/test/example.ts': 'const foo = "bar";\nconst baz = "foo";',
    });
  });

  it('should apply single edit successfully', async () => {
    const result = await applyEdits('/test/example.ts', [
      { old_string: 'foo', new_string: 'replaced' },
    ]);

    expect(result.success).toBe(true);
    expect(result.edits_applied).toBe(1);

    // Verify file content changed
    const content = vol.readFileSync('/test/example.ts', 'utf-8');
    expect(content).toBe('const replaced = "bar";\nconst baz = "foo";');
  });

  it('should fail atomically when second edit fails', async () => {
    const result = await applyEdits('/test/example.ts', [
      { old_string: 'foo', new_string: 'replaced' },
      { old_string: 'nonexistent', new_string: 'fail' }, // Will fail
    ]);

    expect(result.success).toBe(false);
    expect(result.failed_edit_index).toBe(1);

    // Verify file unchanged (atomic rollback)
    const content = vol.readFileSync('/test/example.ts', 'utf-8');
    expect(content).toBe('const foo = "bar";\nconst baz = "foo";');
  });

  it('should support dry run mode', async () => {
    const result = await applyEdits(
      '/test/example.ts',
      [{ old_string: 'foo', new_string: 'replaced' }],
      true // dry_run
    );

    expect(result.success).toBe(true);
    expect(result.dry_run).toBe(true);

    // Verify file unchanged
    const content = vol.readFileSync('/test/example.ts', 'utf-8');
    expect(content).toBe('const foo = "bar";\nconst baz = "foo";');
  });

  it('should handle file not found error', async () => {
    const result = await applyEdits('/nonexistent/file.ts', [
      { old_string: 'foo', new_string: 'bar' },
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to read file');
  });
});
```

### Testing write-file-atomic with memfs

**Confidence: MEDIUM** (memfs may not perfectly simulate atomic rename semantics)

**Consideration:** `write-file-atomic` uses temp files and `fs.rename()`. When mocking with memfs:
- Basic functionality works
- Atomic rename semantics may differ slightly from real filesystem

**Recommendation:**
1. Unit tests use memfs for fast iteration
2. Integration tests use real filesystem in temp directory for atomic operation verification

```typescript
// Integration test with real filesystem
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { applyEdits } from '../../src/core/editor.js';

describe('applyEdits (integration)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should write atomically to real filesystem', async () => {
    const filePath = path.join(tempDir, 'test.ts');
    await fs.writeFile(filePath, 'const foo = "bar";');

    const result = await applyEdits(filePath, [
      { old_string: 'foo', new_string: 'replaced' },
    ]);

    expect(result.success).toBe(true);
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toBe('const replaced = "bar";');
  });
});
```

---

## Multi-File Atomic Operations

### Pattern: Collect-Validate-Then-Write

**Confidence: MEDIUM** (pattern is sound; no standard library for cross-file transactions)

**Challenge:** True atomic operations across multiple files require distributed transaction semantics that Node.js/filesystem don't natively support.

**Pragmatic approach:**
1. Validate ALL files and ALL edits first (read-only phase)
2. Compute ALL new content in memory
3. Write files sequentially with backup
4. On any write failure, restore from backups

**Implementation:**

```typescript
export async function applyMultiFileEdits(
  files: Array<{ file_path: string; edits: EditOperation[] }>,
  dryRun: boolean = false,
  createBackup: boolean = false
): Promise<MultiEditFilesResult> {
  // PHASE 1: Read and validate all files
  const plans: Array<{
    file_path: string;
    original_content: string;
    new_content: string;
    edit_results: EditResult[];
  }> = [];

  for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
    const { file_path, edits } = files[fileIdx];

    // Read file
    let content: string;
    try {
      content = await fs.readFile(file_path, 'utf-8');
    } catch (error) {
      return {
        success: false,
        files_edited: 0,
        file_results: [],
        error: `File ${fileIdx + 1} (${file_path}): Failed to read`,
        failed_file_index: fileIdx,
        dry_run: dryRun,
      };
    }

    // Validate and compute new content
    let workingContent = content;
    const editResults: EditResult[] = [];

    for (let editIdx = 0; editIdx < edits.length; editIdx++) {
      const edit = edits[editIdx];
      const occurrences = findOccurrences(workingContent, edit.old_string);

      if (occurrences === 0) {
        return {
          success: false,
          files_edited: 0,
          file_results: [],
          error: `File ${fileIdx + 1}, Edit ${editIdx + 1}: old_string not found`,
          failed_file_index: fileIdx,
          dry_run: dryRun,
        };
      }

      const replaced = replaceString(workingContent, edit.old_string, edit.new_string, edit.replace_all);
      workingContent = replaced.content;
      editResults.push({
        old_string: edit.old_string,
        matches: occurrences,
        replaced: replaced.replacedCount,
        success: true,
      });
    }

    plans.push({
      file_path,
      original_content: content,
      new_content: workingContent,
      edit_results: editResults,
    });
  }

  // PHASE 2: Execute writes (with rollback on failure)
  if (!dryRun) {
    const backups: Array<{ file_path: string; backup_path: string }> = [];

    try {
      for (const plan of plans) {
        // Create backup
        if (createBackup) {
          const backupPath = `${plan.file_path}.bak`;
          await fs.copyFile(plan.file_path, backupPath);
          backups.push({ file_path: plan.file_path, backup_path: backupPath });
        }

        // Write new content atomically
        await writeFileAtomic(plan.file_path, plan.new_content);
      }
    } catch (error) {
      // ROLLBACK: Restore from backups
      for (const { file_path, backup_path } of backups) {
        try {
          await fs.copyFile(backup_path, file_path);
        } catch {
          // Best effort rollback - log but don't throw
          console.error(`Failed to restore ${file_path} from backup`);
        }
      }

      return {
        success: false,
        files_edited: 0,
        file_results: [],
        error: `Write failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        dry_run: dryRun,
      };
    }
  }

  // Return success
  return {
    success: true,
    files_edited: plans.length,
    file_results: plans.map(p => ({
      success: true,
      file_path: p.file_path,
      edits_applied: p.edit_results.length,
      results: p.edit_results,
      dry_run: dryRun,
    })),
    dry_run: dryRun,
  };
}
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Recommended |
|----------|-------------|-------------|---------------------|
| Atomic writes | write-file-atomic | Manual temp+rename | Edge cases (concurrent writes, cleanup) are hard to handle correctly |
| Atomic writes | write-file-atomic | atomically | `atomically` is smaller but less battle-tested (write-file-atomic is npm official) |
| File mocking | memfs | mock-fs | memfs has better TypeScript support and Vitest integration |
| File mocking | memfs | Manual vi.mock | memfs provides complete fs simulation vs selective mocking |
| Validation | Zod | io-ts / Yup | Zod has best TypeScript inference; already in project |

---

## Installation

```bash
# Core dependencies (already in package.json)
npm install @modelcontextprotocol/sdk zod

# Add for atomic writes
npm install write-file-atomic

# Dev dependencies (already in package.json)
npm install -D vitest @vitest/coverage-v8 typescript tsx @types/node

# Add for testing
npm install -D memfs
```

---

## Sources

### HIGH Confidence (Official Documentation)
- [MCP TypeScript SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk) via Context7
- [MCP Specification - Tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [write-file-atomic GitHub](https://github.com/npm/write-file-atomic)
- [Vitest File System Mocking](https://vitest.dev/guide/mocking/file-system)

### MEDIUM Confidence (Verified Community Patterns)
- [MCPcat Error Handling Guide](https://mcpcat.io/guides/error-handling-custom-mcp-servers/)
- [Better MCP Error Responses - Alpic AI](https://alpic.ai/blog/better-mcp-tool-call-error-responses-ai-recover-gracefully)
- [Mock fs with Vitest and memfs](https://kschaul.com/til/2024/06/26/mock-fs-with-vitest-and-memfs/)

### LOW Confidence (General Patterns)
- Node.js transaction patterns for multi-file operations (no standard library; custom implementation needed)
