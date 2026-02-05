# Architecture Patterns

**Domain:** MCP Server - Atomic File Editing
**Researched:** 2026-02-05
**Confidence:** HIGH (verified against MCP SDK documentation and Node.js best practices)

## Executive Summary

The MCP Multi-Edit Server requires a layered architecture that separates concerns between protocol handling (MCP), input validation (Zod), business logic (editing engine), and file I/O (atomic operations). The key architectural challenge is achieving atomicity at two levels: single-file edits (all replacements succeed or none apply) and multi-file edits (all files succeed or all revert).

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Protocol Layer                       │
│  src/index.ts - Server, Transport, Request/Response routing  │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    Tool Handler Layer                        │
│  src/tools/multi-edit.ts       (single file handler)        │
│  src/tools/multi-edit-files.ts (multi-file handler)         │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                     Core Logic Layer                         │
│  src/core/validator.ts  (Zod schemas, input validation)     │
│  src/core/editor.ts     (editing engine, atomicity)         │
│  src/core/reporter.ts   (result formatting)                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    File System Layer                         │
│  Node.js fs/promises (read, write, rename)                  │
│  Atomic write pattern (temp file + rename)                  │
└─────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `src/index.ts` | MCP server setup, request routing, tool registration | Tool handlers |
| `src/tools/multi-edit.ts` | Handle single-file edit requests, validate paths, orchestrate single-file atomicity | validator.ts, editor.ts, reporter.ts |
| `src/tools/multi-edit-files.ts` | Handle multi-file edit requests, orchestrate cross-file atomicity with rollback | validator.ts, editor.ts, reporter.ts |
| `src/core/validator.ts` | Zod schemas, input validation, conflict detection | Called by tool handlers |
| `src/core/editor.ts` | Apply edits to content, manage single-file atomicity | Called by tool handlers |
| `src/core/reporter.ts` | Format results for MCP response, generate diff previews | Called by tool handlers |
| `src/types/index.ts` | TypeScript interfaces (shared) | All components |

### Data Flow

**Single-File Edit Flow (`multi_edit`):**

```
Request → Validate Input (Zod)
       → Validate Path (absolute)
       → Read Original Content
       → Validate All Edits Can Apply (check matches exist)
       → Apply Edits Sequentially (in memory)
       → [Optional] Create Backup
       → Write Atomically (temp file + rename)
       → Format & Return Result
```

**Multi-File Edit Flow (`multi_edit_files`):**

```
Request → Validate Input (Zod)
       → Validate All Paths (absolute)
       → Phase 1: Read all files into memory
       → Phase 2: Validate all edits for all files
       → Phase 3: Apply all edits in memory (no disk writes)
       → Phase 4: Write all files atomically
                  - If any write fails, rollback all
       → Format & Return Result
```

## Patterns to Follow

### Pattern 1: Temporary File + Atomic Rename

**What:** Write to temporary file, then rename to target path. This is the industry-standard pattern for atomic file operations.

**When:** Every file write operation.

**Why:** `fs.rename()` is atomic on POSIX systems. Writing to a temp file first ensures the target file is never in a partial state.

**Example:**
```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  const tempPath = path.join(
    dir,
    `.${path.basename(filePath)}.${crypto.randomBytes(6).toString('hex')}.tmp`
  );

  try {
    // Write to temp file
    await fs.writeFile(tempPath, content, 'utf8');

    // Atomic rename to target
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on failure
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}
```

**Source:** [write-file-atomic on GitHub](https://github.com/npm/write-file-atomic), [fast-write-atomic](https://github.com/mcollina/fast-write-atomic)

### Pattern 2: Two-Phase Commit for Multi-File Operations

**What:** Separate validation/preparation from execution. Validate all operations can succeed before making any changes.

**When:** `multi_edit_files` with multiple files.

**Why:** Ensures atomicity across files. If any file would fail, we detect it before modifying any file.

**Implementation Phases:**

1. **Read Phase:** Load all file contents into memory
2. **Validation Phase:** Verify all edits can be applied to all files
3. **Transform Phase:** Apply all edits in memory (no disk I/O)
4. **Commit Phase:** Write all files atomically
5. **Rollback (on failure):** Restore original contents from memory

**Example:**
```typescript
interface FileState {
  path: string;
  originalContent: string;
  newContent: string;
  written: boolean;
}

async function applyMultiFileEdits(
  files: FileEditRequest[],
  dryRun: boolean
): Promise<MultiEditFilesResult> {
  const fileStates: FileState[] = [];

  // Phase 1: Read all files
  for (const file of files) {
    const content = await fs.readFile(file.file_path, 'utf8');
    fileStates.push({
      path: file.file_path,
      originalContent: content,
      newContent: content,
      written: false,
    });
  }

  // Phase 2 & 3: Validate and transform in memory
  for (let i = 0; i < files.length; i++) {
    const result = applyEditsInMemory(
      fileStates[i].newContent,
      files[i].edits
    );
    if (!result.success) {
      return createFilesErrorResult(result.error, i, []);
    }
    fileStates[i].newContent = result.content;
  }

  if (dryRun) {
    return createDryRunResult(fileStates);
  }

  // Phase 4: Commit - write all files
  try {
    for (const state of fileStates) {
      await writeFileAtomic(state.path, state.newContent);
      state.written = true;
    }
    return createFilesSuccessResult(fileStates);
  } catch (error) {
    // Phase 5: Rollback on failure
    await rollbackFiles(fileStates);
    throw error;
  }
}

async function rollbackFiles(fileStates: FileState[]): Promise<void> {
  for (const state of fileStates) {
    if (state.written) {
      try {
        await writeFileAtomic(state.path, state.originalContent);
      } catch {
        // Log but continue rollback
        console.error(`Failed to rollback ${state.path}`);
      }
    }
  }
}
```

### Pattern 3: Fail-Fast Validation

**What:** Validate all inputs and preconditions before any mutation.

**When:** Every tool invocation.

**Why:** Prevents partial operations. User gets immediate feedback if something is wrong.

**Validation Order:**
1. Schema validation (Zod) - structural correctness
2. Path validation - absolute paths, file existence
3. Edit validation - search strings exist in content
4. Conflict detection - overlapping edits warning

**Example:**
```typescript
export async function validateEditsWillApply(
  content: string,
  edits: EditOperation[]
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (let i = 0; i < edits.length; i++) {
    const matches = findOccurrences(content, edits[i].old_string);
    if (matches === 0) {
      errors.push(
        `Edit ${i}: old_string "${truncate(edits[i].old_string, 50)}" not found in file`
      );
    }
    // Apply edit for subsequent validation (edits are sequential)
    if (matches > 0) {
      const result = replaceString(
        content,
        edits[i].old_string,
        edits[i].new_string,
        edits[i].replace_all
      );
      content = result.content;
    }
  }

  return { valid: errors.length === 0, errors };
}
```

### Pattern 4: Structured Error Responses

**What:** Return detailed, structured error information in MCP responses.

**When:** Any operation failure.

**Why:** Enables Claude to understand what went wrong and potentially suggest fixes.

**Example:**
```typescript
// Good: Structured error with context
{
  success: false,
  file_path: "/path/to/file.ts",
  edits_applied: 0,
  error: "Edit 2 failed: old_string 'function foo' not found in file",
  failed_edit_index: 2,
  results: [
    { old_string: "const x", matches: 1, replaced: 1, success: true },
    { old_string: "let y", matches: 1, replaced: 1, success: true },
    { old_string: "function foo", matches: 0, replaced: 0, success: false,
      error: "String not found in file" }
  ],
  dry_run: false
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Sequential File Writes Without Rollback

**What:** Writing files one at a time without tracking what was written for rollback.

**Why bad:** If file 3 of 5 fails, files 1-2 are already modified. System is left in inconsistent state.

**Instead:** Track all write operations; implement rollback that restores original content from memory.

### Anti-Pattern 2: Direct fs.writeFile Without Atomic Rename

**What:** Using `fs.writeFile()` directly to the target path.

**Why bad:** If process crashes mid-write, file is corrupted (half-written). If disk is full, file may be truncated.

**Instead:** Always use temp file + rename pattern for atomic writes.

### Anti-Pattern 3: Validating Edits Against Original Content Only

**What:** Checking if all `old_string` values exist in the original file content, then applying edits.

**Why bad:** Edits are sequential. Edit 2's `old_string` might be created by edit 1's replacement, or might have been removed by edit 1.

**Instead:** Validate edits sequentially, simulating each edit's effect on content before validating the next.

### Anti-Pattern 4: Throwing Exceptions from Tool Handlers

**What:** Letting exceptions propagate out of tool handlers.

**Why bad:** MCP SDK may not format the error properly. Client gets generic error.

**Instead:** Catch all exceptions in tool handlers; return structured error responses with `isError: true`.

```typescript
// Bad
export async function handleMultiEdit(args: unknown) {
  const result = await applyEdits(...); // May throw
  return { content: [{ type: 'text', text: formatResult(result) }] };
}

// Good
export async function handleMultiEdit(args: unknown) {
  try {
    const result = await applyEdits(...);
    return {
      content: [{ type: 'text', text: formatResult(result) }],
      isError: !result.success
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }],
      isError: true
    };
  }
}
```

## Implementation Implications

### Implementation Order

Based on architectural dependencies, implement in this order:

1. **`src/core/editor.ts` - `applyEdits` function** (HIGH priority)
   - This is the core editing engine
   - Implements single-file atomicity
   - All other components depend on this
   - Test with unit tests first

2. **Wire up `src/tools/multi-edit.ts`** (HIGH priority)
   - Connect handler to `applyEdits`
   - Uncomment imports in `src/index.ts`
   - Integration test with MCP client

3. **`src/tools/multi-edit-files.ts` - multi-file atomicity** (HIGH priority)
   - Implement two-phase commit pattern
   - Add rollback capability
   - Track file states in memory

4. **`src/core/editor.ts` - backup file creation** (MEDIUM priority)
   - Add optional `.bak` file creation
   - Must happen before atomic write

5. **Enhanced conflict detection** (MEDIUM priority)
   - Improve `detectOverlappingEdits` in validator.ts
   - Add warnings (not errors) to results

### Key Dependencies

```
src/index.ts
    └── src/tools/multi-edit.ts
    │       └── src/core/editor.ts (applyEdits)
    │       └── src/core/validator.ts
    │       └── src/core/reporter.ts
    └── src/tools/multi-edit-files.ts
            └── src/core/editor.ts (applyEdits)
            └── src/core/validator.ts
            └── src/core/reporter.ts
```

### Testing Strategy Per Component

| Component | Test Type | Key Test Cases |
|-----------|-----------|----------------|
| `editor.ts` | Unit | Single edit, multiple edits, no match, replace_all, Unicode |
| `editor.ts` | Unit | Atomic write (mock fs), backup creation |
| `validator.ts` | Unit | Valid/invalid inputs, conflict detection |
| `multi-edit.ts` | Integration | Full flow with temp files, error cases |
| `multi-edit-files.ts` | Integration | Multi-file atomicity, rollback on failure |

### File System Assumptions

1. **POSIX `rename()` is atomic** - True for same-filesystem renames
2. **Directory must exist** - We don't create parent directories
3. **Sufficient disk space** - No explicit check (fs will error)
4. **File permissions** - Read/write access required

## Scalability Considerations

| Concern | Current Scale | At 100 files | At 1000+ files |
|---------|---------------|--------------|----------------|
| Memory | O(n) file content | ~100MB if large files | May need streaming |
| File handles | 1 per file | 100 handles OK | May hit ulimit |
| Rollback time | O(n) writes | Seconds | Consider parallel writes |
| Validation time | O(n*m) edits | Fast | Consider caching |

For this MCP server's typical use case (editing source files, typically <1MB each, typically <20 files), in-memory approach is appropriate.

## Sources

- [MCP TypeScript SDK - Server Documentation](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) - HIGH confidence
- [write-file-atomic npm package](https://www.npmjs.com/package/write-file-atomic) - HIGH confidence
- [fast-write-atomic on GitHub](https://github.com/mcollina/fast-write-atomic) - HIGH confidence
- [Node.js Design Patterns - File Operations](https://nodejsdesignpatterns.com/blog/reading-writing-files-nodejs/) - MEDIUM confidence
- [Transactional File Management patterns](https://www.codeproject.com/Articles/15339/Transactional-File-Management-in-NET) - MEDIUM confidence (concepts apply cross-platform)
