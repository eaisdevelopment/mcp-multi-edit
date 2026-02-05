# Codebase Concerns

**Analysis Date:** 2026-02-05

## Critical Missing Implementations

**Core Editor Logic Not Implemented:**
- Issue: `applyEdits()` function in `src/core/editor.ts` (lines 19-33) only throws "Not implemented" error
- Files: `src/core/editor.ts`
- Impact: Both `multi_edit` and `multi_edit_files` tools are non-functional; server returns error for all actual edit requests
- Fix approach: Implement file I/O logic with atomic transaction semantics (read → validate → apply sequentially → write), include error handling for file access and permission issues

**Tool Handler Wiring Missing:**
- Issue: `src/index.ts` (lines 15-17, 136-160) has tool handlers commented out and stubbed with "Not implemented yet" errors
- Files: `src/index.ts`
- Impact: `CallToolRequestSchema` handler does not invoke actual tool implementations; server advertises tools but cannot execute them
- Fix approach: Uncomment imports and wire `handleMultiEdit` and `handleMultiEditFiles` handlers into the request handler

**Atomic Multi-File Editing Not Implemented:**
- Issue: `src/tools/multi-edit-files.ts` (line 61) has TODO comment; currently applies edits sequentially per file, not atomically across all files
- Files: `src/tools/multi-edit-files.ts`
- Impact: If a failure occurs during the third file of five, first two files are modified and cannot be rolled back; violates advertised atomicity guarantee
- Fix approach: Implement true atomic approach: read all files into memory first, validate all edits, apply all edits to in-memory copies, write all files only if all succeed, include rollback mechanism for partial failures

## Integration Test Coverage Gaps

**No Integration Tests Implemented:**
- Issue: `tests/integration/server.test.ts` contains only test skeletons with `.todo()` placeholders
- Files: `tests/integration/server.test.ts`
- Impact: Cannot verify end-to-end behavior with actual MCP client; no validation that tool registration, input handling, and output formatting work correctly
- Priority: High (blocks production readiness)
- Test coverage: All integration tests need real MCP client setup and fixture-based testing

**No applyEdits Tests:**
- Issue: `tests/unit/editor.test.ts` (line 79) has TODO comment for `applyEdits()` tests
- Files: `tests/unit/editor.test.ts`
- Impact: Main business logic has zero test coverage; edge cases like empty files, large files, concurrent edits, encoding issues are untested
- Priority: Critical (this is the core function)

## Platform-Specific Issues

**Windows Path Handling Broken:**
- Issue: `isAbsolutePath()` in `src/core/validator.ts` (line 57-59) only checks for Unix-style paths starting with `/`
- Files: `src/core/validator.ts`
- Impact: Rejects valid Windows paths like `C:\Users\file.txt` or `D:\\projects\\code.ts`; makes tool unusable on Windows systems
- Fix approach: Use Node.js `path.isAbsolute()` or implement proper Windows+Unix detection: `return /^(\/|[a-zA-Z]:)/.test(filePath)`
- Blocks: Windows deployment, cross-platform testing

**Relative Path Traversal Not Prevented:**
- Issue: No validation against `../` sequences in file paths; validator only checks if path is absolute
- Files: `src/core/validator.ts`, `src/tools/multi-edit.ts`, `src/tools/multi-edit-files.ts`
- Impact: Client could request edits to `/home/user/../../../etc/passwd` or similar; creates security risk if server runs with elevated privileges
- Fix approach: Add path normalization and validation to prevent directory traversal, verify resolved path stays within expected boundaries

## Atomicity and Rollback Concerns

**No Backup/Rollback Mechanism:**
- Issue: `create_backup` parameter is accepted in schema but never used; `applyEdits()` doesn't implement backup creation
- Files: `src/index.ts` (lines 70-73, 116-119), `src/core/editor.ts` (lines 20-23), `src/tools/multi-edit.ts` (line 47), `src/tools/multi-edit-files.ts` (line 72)
- Impact: If edit operation fails mid-way, file is left in corrupted state; no recovery mechanism; users cannot restore original content
- Fix approach: Before any file modification, create `.bak` file with original content; on failure, automatically restore from `.bak`; allow user control via `create_backup` parameter

**No Transaction Isolation:**
- Issue: Reading, modifying, and writing files sequentially without any locking mechanism
- Files: `src/core/editor.ts` (to be implemented)
- Impact: If another process modifies the file during the multi-edit operation (between read and write), changes get overwritten without warning
- Fix approach: Implement file locking with `fs.open()` flags or explicit lock files; check file modification time before writing; return error if file changed since read

## Data Handling Issues

**Large File Memory Risk:**
- Issue: `applyEdits()` will read entire file into memory (via `fs/promises`); no file size limits checked
- Files: `src/core/editor.ts`
- Impact: A 500MB file would load entirely into RAM; could cause OOM errors or freeze server; no streaming/chunked processing
- Fix approach: Add configurable file size limit (e.g., 100MB); error early if exceeded; consider streaming approach for very large files

**No Encoding Detection:**
- Issue: File reading assumes UTF-8; no BOM handling, encoding detection, or fallback for different encodings
- Files: `src/core/editor.ts` (to be implemented)
- Impact: Binary files or non-UTF-8 text (Latin-1, ISO-8859-1, UTF-16) will be corrupted silently
- Fix approach: Detect encoding via BOM or file analysis; validate after reading that content is valid UTF-8; reject unsupported encodings

**Newline Handling Not Specified:**
- Issue: No specification for how line endings are preserved (CRLF vs LF); string operations don't account for mixed endings
- Files: `src/core/editor.ts`, `src/core/reporter.ts` (diff generation)
- Impact: Editing files with CRLF line endings could accidentally convert to LF; diff output incorrect for binary line endings
- Fix approach: Detect original line ending style, preserve it after edits; handle CRLF/LF/CR separately

## Validation Gaps

**Empty Search String Allowed by Schema:**
- Issue: `EditOperationSchema` validates `old_string` is min 1 character (line 11 in validator.ts), but `replaceString()` still checks and returns 0 replacements (line 64-66 in editor.ts)
- Files: `src/core/validator.ts` (line 11), `src/core/editor.ts` (line 64-66)
- Impact: Inconsistent - validation prevents empty but code handles it anyway; confusing error reporting
- Fix approach: Rely on schema validation; remove defensive code in `replaceString()`

**Overlapping Edits Detection Not Enforced:**
- Issue: `detectOverlappingEdits()` exists in `src/core/validator.ts` (lines 65-85) but is never called
- Files: `src/core/validator.ts`, `src/tools/multi-edit.ts`, `src/tools/multi-edit-files.ts`
- Impact: User can request edits that create ambiguous results (e.g., replace "foo" with "foobar", then "bar" with "baz" - second edit won't find "bar" after first); operation succeeds but without expected changes
- Fix approach: Call `detectOverlappingEdits()` in tool handlers; either warn user in result or reject with error

**No Duplicate Edit Detection:**
- Issue: No check for identical/redundant edits in the array
- Files: `src/tools/multi-edit.ts`, `src/tools/multi-edit-files.ts`
- Impact: User might accidentally request same replacement twice; wasted work and confusing results
- Fix approach: Add validation to deduplicate or warn about redundant operations

## Error Handling Deficiencies

**Generic Error Messages Leak No Context:**
- Issue: Tool handlers in `src/index.ts` (line 172) catch errors but only return `error.message`; stack traces lost
- Files: `src/index.ts` (lines 171-182), `src/tools/multi-edit.ts` (lines 54-60), `src/tools/multi-edit-files.ts` (lines 108-115)
- Impact: Debugging production issues difficult; cannot distinguish permission errors from file-not-found from encoding errors
- Fix approach: Include error type/code in response, log full error with stack trace server-side, return structured error object with `code` and `details`

**No Handling for Specific System Errors:**
- Issue: No differentiation between ENOENT (file not found), EACCES (permission denied), EISDIR (is directory), etc.
- Files: `src/core/editor.ts` (to be implemented)
- Impact: Client cannot distinguish recoverable errors (retry) from fatal ones (user action needed)
- Fix approach: Catch `NodeJS.ErrnoException` specifically; map errno to user-friendly messages

**Partial Edit Failure Not Handled:**
- Issue: If edit #3 of 5 fails, edits #1-2 are already applied to content; `applyEdits()` doesn't track which succeeded before failure
- Files: `src/core/editor.ts` (to be implemented)
- Impact: Result doesn't clearly indicate what succeeded vs failed; no rollback; file left in partially-modified state
- Fix approach: Track all edit successes/failures individually; return detailed result showing which edits failed and why; support rollback on first failure

## Security Considerations

**Path Injection Vulnerability:**
- Risk: Absolute path validation only checks leading `/`; no normalization of `..` sequences
- Files: `src/core/validator.ts` (line 57-59), `src/tools/multi-edit.ts` (line 34-39), `src/tools/multi-edit-files.ts` (line 38-50)
- Impact: User can request edits to `/etc/passwd` or escape to parent directories if server has broad permissions
- Recommendation: Normalize paths with `path.resolve()`, validate against a whitelist or base directory, reject `../` sequences

**No Content Size Limit:**
- Risk: Client can request replacement with multi-MB strings, consuming memory
- Files: `src/core/editor.ts` (to be implemented)
- Impact: Denial of service: repeated large replacements could exhaust memory
- Recommendation: Add limits on `new_string` length and total replacement size

**No Rate Limiting:**
- Risk: Rapid successive tool calls could exhaust I/O resources
- Files: `src/index.ts` (handler has no rate limiting)
- Impact: Denial of service via rapid file edit requests
- Recommendation: Implement per-client rate limiting or request queuing

## Type Safety Issues

**Unsafe Type Coercion in Tool Handler:**
- Issue: `args` parameter typed as `unknown` but cast directly to input types without runtime check verification (lines 31, 35 in multi-edit.ts)
- Files: `src/tools/multi-edit.ts` (line 31), `src/tools/multi-edit-files.ts` (line 35)
- Impact: If validation somehow passes but data doesn't match expected structure, cast can hide issues
- Fix approach: Trust Zod validation result; destructure from `validation.data` only

**Missing Error Type in Response:**
- Issue: `isError` flag set based on `!result.success` but some code paths return errors without setting flag correctly
- Files: `src/index.ts` (lines 145, 158), `src/tools/multi-edit.ts` (line 52)
- Impact: MCP client might not recognize error responses correctly
- Fix approach: Ensure all error paths set `isError: true`; validate response structure matches MCP spec

## Incomplete Feature Implementation

**Diff Preview Not Integrated:**
- Issue: `generateDiffPreview()` exists in `src/core/reporter.ts` (lines 96-126) but is never called or returned
- Files: `src/core/reporter.ts`, `src/tools/multi-edit.ts`, `src/tools/multi-edit-files.ts`
- Impact: Users requesting `dry_run` mode don't see what changes would be made; defeats purpose of preview
- Fix approach: Include diff output in dry-run results; format as part of MCP response

**Backup Path Not Returned:**
- Issue: `createSuccessResult()` accepts `backupPath` parameter (line 28 in reporter.ts) but `applyEdits()` never creates backups
- Files: `src/core/reporter.ts`, `src/core/editor.ts` (to be implemented)
- Impact: Users cannot know where backup files are created
- Fix approach: Implement backup creation in `applyEdits()`, return backup path in result

## Testing and Coverage

**No Test Fixtures:**
- Issue: `tests/fixtures/sample-files/` exists but `example.ts` is never referenced in tests
- Files: `tests/fixtures/sample-files/example.ts`
- Impact: Integration tests and realistic testing scenarios cannot run
- Fix approach: Create fixture files (binary, large, different encodings, permission issues); use in comprehensive test suite

**No Mocking for File System:**
- Issue: Unit tests don't mock `fs/promises`; integration tests would need actual file system
- Files: Tests lack mocking infrastructure
- Impact: Cannot test error scenarios (permission denied, file not found, disk full) without complex setup
- Fix approach: Add vitest mocks for `fs/promises` in unit tests

## Documentation Gaps

**No README or API Documentation:**
- Issue: No user-facing documentation for tool usage, input/output format, or error codes
- Files: Project root (no README.md found)
- Impact: Clients don't know expected behavior, error recovery strategies, or limitations
- Recommendation: Create README with examples, error reference, limitations, platform support notes

**No Inline Documentation of Edge Cases:**
- Issue: Functions lack comments explaining behavior for: empty files, binary files, very large replacements, overlapping patterns
- Files: Throughout `src/core/editor.ts`
- Impact: Future maintainers won't understand design decisions
- Recommendation: Add JSDoc with @example tags and edge case notes

## Performance Concerns

**Inefficient String Replacement in Large Files:**
- Issue: `findOccurrences()` and `replaceString()` use `indexOf()` in loops and `split().join()` - O(n) for each operation
- Files: `src/core/editor.ts` (lines 38-47, 68-71)
- Impact: For 5 edits on a 10MB file, could trigger 5+ full string scans; CPU-intensive
- Fix approach: Consider single-pass algorithm or precompute positions if file size > threshold

**No Caching of File Reads:**
- Issue: Each edit operation reads the file fresh from disk
- Files: `src/core/editor.ts` (to be implemented)
- Impact: In `multi_edit_files`, if editing same file twice, reads it twice
- Fix approach: Cache reads within a single operation; but ensure cache invalidation on partial failures

## Production Readiness Blockers

**No Logging:**
- Issue: Console.error used for startup message (line 189 in index.ts) but no structured logging anywhere
- Files: `src/index.ts`
- Impact: Cannot debug production issues; no audit trail of edits; error tracking impossible
- Fix approach: Add `winston` or `pino` logging; log file edits with before/after checksums; log all errors with context

**No Graceful Shutdown:**
- Issue: Server started but has no shutdown handler for cleanup
- Files: `src/index.ts` (lines 186-192)
- Impact: Long-running edits interrupted abruptly; no chance to finalize operations
- Fix approach: Add signal handlers for SIGTERM/SIGINT; allow in-flight operations to complete before exit

**No Health Check Endpoint:**
- Issue: MCP server has no heartbeat or health verification mechanism
- Files: `src/index.ts`
- Impact: Clients cannot verify server is responsive; dead servers detected only on actual tool call
- Fix approach: Add optional `health` resource or implement timeout mechanisms at MCP SDK level

---

*Concerns audit: 2026-02-05*
