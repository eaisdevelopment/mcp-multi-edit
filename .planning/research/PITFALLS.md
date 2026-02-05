# Domain Pitfalls: MCP Multi-Edit Server

**Domain:** MCP File Editing Tools
**Researched:** 2026-02-05
**Confidence:** HIGH (verified via MCP SDK docs, security research, and real-world issue reports)

---

## Critical Pitfalls

Mistakes that cause security vulnerabilities, data corruption, or require rewrites.

---

### Pitfall 1: False Atomicity Through Sequential Operations

**What goes wrong:** Developers assume that a sequence of individually atomic operations (read, validate, write) produces an atomic multi-edit. In reality, the file can be modified between operations, leaving partial edits applied.

**Why it happens:** Each Node.js fs operation is atomic individually, but `readFile -> transform -> writeFile` is NOT atomic as a group. Another process can modify the file between read and write.

**Consequences:**
- File ends up with only some edits applied
- Corrupted state if crash occurs mid-operation
- Race conditions when multiple tools edit same file

**Warning signs:**
- Code structure: `await readFile(); ... await writeFile()`
- No file locking mechanism
- No verification that file hasn't changed between read and write

**Prevention:**
1. Use write-then-rename pattern: write to temp file, then atomically rename
2. Calculate file hash before read, verify unchanged before write
3. Consider advisory locking for concurrent access scenarios
4. Test with concurrent edit simulations

**Phase to address:** Core implementation (editor.ts) - MUST be correct from day one

**Sources:**
- [write-file-atomic GitHub](https://github.com/npm/write-file-atomic)
- [Towards Atomic File Modifications](https://dev.to/martinhaeusler/towards-atomic-file-modifications-2a9n)

---

### Pitfall 2: Path Traversal Vulnerabilities

**What goes wrong:** User-supplied file paths containing `../` or symlinks allow access to files outside intended directories. MCP servers running locally can expose SSH keys, AWS credentials, and .env files.

**Why it happens:** Developers trust that the LLM will only request valid paths. They validate path format but not path resolution. Symlinks bypass directory prefix checks.

**Consequences:**
- Arbitrary file read/write on developer machine
- Credential theft (SSH keys, API tokens, AWS secrets)
- Code injection via editing system files

**Warning signs:**
- Path validation only checks `startsWith('/') || startsWith('C:')`
- No `path.resolve()` + base directory verification
- No symlink resolution and checking
- Accepting decoded URL parameters directly

**Prevention:**
1. Always resolve paths with `path.resolve()`
2. Verify resolved path starts with allowed base directory AFTER resolution
3. Resolve symlinks and verify real path is within allowed directory
4. Reject paths containing `..` as a defense-in-depth measure
5. Consider allowlisting specific directories rather than blocklisting patterns

**Phase to address:** Validation phase - implement before any file operations

**Sources:**
- [Snyk: Building Secure MCP Servers](https://snyk.io/articles/building-secure-mcp-servers/)
- [Snyk: Preventing Path Traversal in MCP](https://snyk.io/articles/preventing-path-traversal-vulnerabilities-in-mcp-server-function-handlers/)
- [GitHub IBM MCP Security Issue](https://github.com/IBM/mcp-context-forge/issues/221)

---

### Pitfall 3: String Matching Ambiguity (Non-Unique old_string)

**What goes wrong:** The `old_string` appears multiple times in the file but `replace_all: false`. Which occurrence gets replaced is undefined/implementation-dependent. User expects one location, tool edits another.

**Why it happens:** Find-and-replace semantics are ambiguous when strings aren't unique. Claude Code's Edit tool requires unique strings, but multi-edit tools often don't enforce this.

**Consequences:**
- Wrong code section edited
- Silent corruption that passes tests but breaks production
- User loses trust in tool reliability

**Warning signs:**
- No uniqueness check before applying edits
- No warning when multiple matches exist for non-replace_all edit
- Using `indexOf()` without considering multiple matches

**Prevention:**
1. Count occurrences before editing
2. If `replace_all: false` and matches > 1, return error with match count
3. Provide match context (line numbers, surrounding text) in error message
4. Consider adding `expected_matches: number` parameter for explicit control

**Phase to address:** Core implementation (editor.ts) - affects API design

**Sources:**
- [Claude Code Edit Tool Crash on String Mismatch](https://github.com/anthropics/claude-code/issues/3309)
- [Eclipse: Overlapping Text Edits Bug](https://bugs.eclipse.org/bugs/show_bug.cgi?id=535536)

---

### Pitfall 4: Edit Ordering Dependencies and Overlaps

**What goes wrong:** Earlier edits in the array change the file content, causing later edits' `old_string` to no longer match (because positions shifted or content was modified).

**Why it happens:** Sequential string replacement without considering how each edit affects subsequent search targets. Edit A's `new_string` might contain Edit B's `old_string`, or Edit A might modify the region Edit B targets.

**Consequences:**
- Later edits fail silently or match wrong location
- Order of edits array affects outcome unpredictably
- "String not found" errors that confuse users

**Warning signs:**
- No overlap detection between edits
- Processing edits in simple loop without dependency analysis
- No test cases for edits that affect each other

**Prevention:**
1. Implement overlap/conflict detection (the project already has `detectOverlappingEdits`)
2. Validate ALL edits against ORIGINAL content before applying any
3. Calculate positions in original file, not intermediate states
4. Warn users about potential conflicts in dry_run output
5. Document that edits are applied sequentially and earlier edits affect later ones

**Phase to address:** Core implementation - critical for atomicity guarantee

---

### Pitfall 5: Improper MCP Error Response Format

**What goes wrong:** Throwing exceptions or returning plain text errors instead of proper MCP tool response format with `isError: true`. Errors don't reach the LLM context, or crash the server.

**Why it happens:** Developers familiar with REST APIs or CLI tools expect exceptions to propagate. MCP has specific error semantics where tool failures return SUCCESS at protocol level but `isError: true` in response.

**Consequences:**
- Server crashes on first error
- LLM cannot see error details and cannot recover
- Errors appear as connection failures, not tool failures

**Warning signs:**
- `throw new Error()` in tool handlers without try/catch
- Returning plain strings instead of `{ content: [...], isError: true }`
- No distinction between protocol errors and application errors

**Prevention:**
1. Wrap all tool handlers in try/catch
2. Return `{ content: [{ type: 'text', text: errorMessage }], isError: true }`
3. Log full stack trace server-side, return sanitized message to client
4. Provide actionable error messages that help LLM retry correctly
5. Use MCP SDK error types (ProtocolError, SdkError) appropriately

**Phase to address:** Tool implementation phase - affects all tool handlers

**Sources:**
- [MCP Error Handling Best Practices](https://mcpcat.io/guides/error-handling-custom-mcp-servers/)
- [MCP SDK Error Handling Docs](https://context7.com/modelcontextprotocol/typescript-sdk)
- [Better MCP Error Responses](https://alpic.ai/blog/better-mcp-tool-call-error-responses-ai-recover-gracefully)

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or poor user experience.

---

### Pitfall 6: Ignoring File Encoding and Line Endings

**What goes wrong:** Tool assumes UTF-8 but file uses UTF-16, Latin-1, or has BOM. Tool normalizes CRLF to LF, corrupting binary-like content or breaking Windows-specific files.

**Why it happens:** Modern editors handle encoding transparently. Developers don't realize files in the wild have varying encodings. Git on Windows adds complexity with autocrlf.

**Consequences:**
- Files become unreadable or cause compile errors
- "String not found" when encoding mismatch hides the match
- Binary files corrupted by text normalization

**Warning signs:**
- Hardcoded `'utf-8'` encoding without detection
- No handling of BOM (Byte Order Mark)
- Normalizing line endings without option to preserve

**Prevention:**
1. Read file as buffer first, detect encoding
2. Preserve original encoding when writing
3. Preserve original line ending style (or make it explicit option)
4. Warn if file appears to be binary (contains null bytes)
5. Test with UTF-8 BOM files, UTF-16 files, and mixed line endings

**Phase to address:** Core implementation - affects file I/O layer

**Sources:**
- [Overleaf: File Encodings and Line Endings](https://docs.overleaf.com/troubleshooting-and-support/file-encodings-and-line-endings)
- [Claude Code: File has been unexpectedly modified](https://github.com/anthropics/claude-code/issues/7443)

---

### Pitfall 7: Incomplete Rollback on Multi-File Operations

**What goes wrong:** In `multi_edit_files`, file 1 and 2 succeed, file 3 fails. Files 1 and 2 remain modified, violating atomicity promise.

**Why it happens:** Each file is edited independently without transaction semantics. Rollback requires keeping backup of all modified files and restoring on any failure.

**Consequences:**
- Codebase in inconsistent state
- Refactorings half-applied across files
- Manual recovery required

**Warning signs:**
- No backup creation before multi-file edit
- No rollback logic in catch blocks
- Success reported before all files verified

**Prevention:**
1. Create backups of ALL files before modifying ANY
2. Apply all edits in memory first, write only after all succeed
3. Implement rollback that restores from backups on any failure
4. Consider using temp files and atomic renames for all modifications
5. Report partial failure state clearly if rollback also fails

**Phase to address:** Multi-file tool implementation - requires careful transaction design

---

### Pitfall 8: Verbose/Noisy Tool Responses

**What goes wrong:** Tool returns entire file contents, full diffs, or excessive metadata in every response. This consumes LLM context window rapidly, reducing available context for the conversation.

**Why it happens:** Developers want to be "helpful" by providing complete information. They don't consider LLM token limits or that the LLM already knows what it requested.

**Consequences:**
- Context window fills quickly with tool output
- Important conversation context gets truncated
- Higher API costs for Claude users

**Warning signs:**
- Including full file content in success responses
- Returning complete diff output for small changes
- No summary mode vs verbose mode option

**Prevention:**
1. Return minimal confirmation: file path, edit count, success status
2. Include brief snippet only around changed regions
3. Provide `verbose` flag for when full output is needed
4. Keep success responses under 500 characters when possible
5. Reserve detailed output for error cases and dry_run

**Phase to address:** Reporter implementation - affects response formatting

---

### Pitfall 9: Missing Input Validation Edge Cases

**What goes wrong:** Tool accepts empty edits array, empty old_string, or old_string === new_string. Operations succeed but do nothing useful, wasting tokens and confusing the LLM.

**Why it happens:** Zod/validation schemas check types but not semantic validity. "Technically valid" input that's logically pointless.

**Consequences:**
- Tool "succeeds" but nothing changes
- LLM retries same operation expecting different result
- Debugging time wasted

**Warning signs:**
- No check for empty old_string
- No check for old_string === new_string
- Accepting edits array of length 0

**Prevention:**
1. Require `old_string.length > 0` (already in validator.ts - good!)
2. Warn if `old_string === new_string` (no-op edit)
3. Require at least one edit in array (already in validator.ts - good!)
4. Validate file_path is absolute (check exists but needs enhancement for Windows)
5. Validate file exists and is readable before processing

**Phase to address:** Validation phase - extend existing Zod schemas

---

### Pitfall 10: Blocking I/O in Async Handlers

**What goes wrong:** Using synchronous file operations (fs.readFileSync, fs.writeFileSync) in MCP tool handlers blocks the event loop, causing timeouts and degraded performance.

**Why it happens:** Synchronous APIs are simpler to use. Developers don't realize MCP servers need to remain responsive during I/O.

**Consequences:**
- Tool calls timeout
- Server becomes unresponsive to concurrent requests
- Poor performance with large files

**Warning signs:**
- `fs.readFileSync` or `fs.writeFileSync` in handler code
- No async/await in file operation code paths
- Synchronous loops over multiple files

**Prevention:**
1. Use async fs APIs exclusively (fs.promises or fs/promises)
2. Process multiple files with `Promise.all` where safe
3. Consider streaming for very large files
4. Add timeout handling for long operations

**Phase to address:** Core implementation - ensure all I/O is async from start

---

## Minor Pitfalls

Mistakes that cause annoyance but are easily fixable.

---

### Pitfall 11: Poor Dry-Run Output

**What goes wrong:** Dry-run mode returns success but provides no useful preview of what WOULD change. User can't verify correctness before committing.

**Prevention:**
1. Show before/after for each edit
2. Include line numbers of matches
3. Show diff-style output with context lines
4. Make clear this is preview, not actual change

**Phase to address:** Reporter implementation

---

### Pitfall 12: Insufficient Error Context

**What goes wrong:** Error says "String not found" but doesn't say which old_string, in which file, or show what content was searched.

**Prevention:**
1. Include the old_string that failed to match
2. Include file path in error
3. Show snippet of file content around expected location
4. Suggest possible causes (encoding, whitespace, already changed)

**Phase to address:** Reporter implementation

---

### Pitfall 13: Windows Path Handling

**What goes wrong:** `isAbsolutePath` only checks for `/` prefix, failing on Windows paths like `C:\Users\...`. Tool rejects valid Windows absolute paths.

**Prevention:**
1. Use `path.isAbsolute()` instead of string prefix check
2. Test on Windows or with Windows-style paths
3. Handle both forward and back slashes

**Phase to address:** Validation phase - fix `isAbsolutePath` function

**Note:** Current implementation in validator.ts only checks `startsWith('/')` - needs fix.

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Types/Schema | Over-complex types | Keep simple, add complexity only when needed |
| Validation | Missing edge cases | Comprehensive test suite for validation |
| Core Editor | False atomicity | Write-then-rename pattern, hash verification |
| Core Editor | Edit ordering bugs | Pre-validate all edits against original content |
| Multi-file Tool | Incomplete rollback | Full backup before any modification |
| Tool Handlers | Wrong error format | Consistent try/catch with isError responses |
| Reporter | Verbose responses | Token-conscious output formatting |
| Integration | Path security | Full path resolution and base directory check |

---

## Pre-Implementation Checklist

Before writing core implementation:

- [ ] Decide on atomicity strategy (write-then-rename vs hash-verify)
- [ ] Plan backup/rollback mechanism for multi-file operations
- [ ] Define clear behavior for non-unique old_string matches
- [ ] Design error response format with LLM recovery in mind
- [ ] Establish encoding handling strategy (preserve vs normalize)
- [ ] Fix Windows path validation issue

---

## Sources

**MCP SDK & Protocol:**
- [MCP TypeScript SDK - Context7](https://context7.com/modelcontextprotocol/typescript-sdk)
- [MCP Error Handling Guide](https://mcpcat.io/guides/error-handling-custom-mcp-servers/)
- [MCP Error Codes](https://www.mcpevals.io/blog/mcp-error-codes)

**Security:**
- [Snyk: Building Secure MCP Servers](https://snyk.io/articles/building-secure-mcp-servers/)
- [Snyk: Preventing Path Traversal](https://snyk.io/articles/preventing-path-traversal-vulnerabilities-in-mcp-server-function-handlers/)

**File Atomicity:**
- [npm write-file-atomic](https://github.com/npm/write-file-atomic)
- [write-file-atomic Issue #64 - Rename not enough](https://github.com/npm/write-file-atomic/issues/64)
- [Towards Atomic File Modifications](https://dev.to/martinhaeusler/towards-atomic-file-modifications-2a9n)

**Real-World Issues:**
- [Claude Code Edit Tool Issues](https://github.com/anthropics/claude-code/issues/3309)
- [Eclipse Overlapping Edits Bug](https://bugs.eclipse.org/bugs/show_bug.cgi?id=535536)
