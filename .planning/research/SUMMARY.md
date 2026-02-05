# Project Research Summary

**Project:** MCP Multi-Edit Server
**Domain:** MCP Server - Atomic File Editing Tools
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

The MCP Multi-Edit Server is a production-quality tool enabling atomic batch file editing for Claude Code and Claude Desktop. The core value proposition is reducing context usage by batching multiple find-and-replace operations into single tool calls while guaranteeing atomicity - all edits succeed or none apply. This addresses a key limitation of Claude's built-in Edit tool which handles only single replacements per call.

The recommended approach uses a layered architecture with in-memory validation followed by atomic write-back via the temp-file-then-rename pattern. Core technologies include TypeScript 5.4+ (strict mode), the official @modelcontextprotocol/sdk, Zod for validation, and the battle-tested write-file-atomic library for crash-safe writes. Testing uses Vitest with memfs for fast unit tests plus real filesystem integration tests to verify atomic operation semantics.

The primary risks are false atomicity through sequential operations, path traversal vulnerabilities, and edit ordering dependencies. These are mitigated through: (1) write-then-rename pattern ensuring no partial states, (2) rigorous path validation with resolution checking, and (3) pre-validating all edits against original content before applying any changes. Implementation should follow strict TDD with 90%+ coverage focusing on edge cases like concurrent edits, non-unique matches, and multi-file rollback scenarios.

## Key Findings

### Recommended Stack

The stack leverages proven tools from the MCP and Node.js ecosystems, prioritizing atomicity and type safety. The critical insight is that standard fs operations are individually atomic but not atomic as a sequence - hence the need for write-file-atomic which implements the industry-standard temp-file-then-rename pattern.

**Core technologies:**
- **@modelcontextprotocol/sdk ^1.0.0**: Official MCP framework with registerTool pattern - provides type-safe protocol handling and proper error semantics
- **TypeScript 5.4+ (strict mode)**: Catches errors at compile time - essential for production-quality tooling
- **Zod ^3.23.0**: Input validation with excellent TypeScript inference - already in project, integrates cleanly with MCP SDK
- **write-file-atomic ^6.0.0**: Battle-tested atomic writes (97M+ weekly downloads) - handles edge cases like concurrent writes and orphaned temp files
- **Vitest ^1.6.0 + memfs ^4.0.0**: Fast testing with in-memory filesystem - isolates tests from real disk, no flakiness

**Critical pattern:** In-memory validation + atomic write-back. Read file once, validate all edits can apply, compute final content in memory, write atomically with temp-file-then-rename. This ensures no partial states survive crashes or errors.

### Expected Features

Research shows file editing tools have clear table-stakes vs. differentiators. The multi-edit tools distinguish themselves through batching (multiple edits per call) and cross-file atomicity - not features Claude's built-in Edit tool provides.

**Must have (table stakes):**
- **Exact string matching** - Claude's paradigm requires precision including whitespace
- **Single-file multi-edit** - Core value proposition: batch multiple changes atomically
- **Non-unique match detection** - Fail if old_string matches multiple locations (unless replace_all)
- **Replace all option** - Per-edit flag for common use cases like renaming variables
- **Dry-run mode** - Preview changes without modifying files (risk mitigation)
- **Clear error messages** - Actionable feedback: "No match found", "Multiple matches found"
- **Path validation** - Security-critical: reject relative paths, validate absolute paths
- **MCP-compliant responses** - Proper content array format with isError flag

**Should have (competitive):**
- **Multi-file atomic edits** - Cross-file refactoring without partial state (key differentiator)
- **Overlap/conflict detection** - Prevent edits that interfere with each other
- **Backup files (.bak)** - Optional recovery mechanism
- **Edit result summary** - Token-conscious output showing what changed
- **Match context in errors** - Show surrounding lines when reporting failures

**Defer (v2+):**
- Regex support (violates exactness principle, complexity explosion)
- AST-aware editing (massive complexity, language-specific)
- Interactive prompts (MCP tools are non-interactive)
- Fuzzy matching (violates precision principle)

### Architecture Approach

The architecture uses strict layering to separate concerns: MCP protocol handling, input validation, business logic (editing engine), and atomic file I/O. The key architectural challenge is achieving atomicity at two levels - single-file (all replacements succeed or none apply) and multi-file (all files succeed or all revert).

**Major components:**
1. **MCP Protocol Layer (src/index.ts)** - Server setup, request routing, tool registration to MCP SDK
2. **Tool Handler Layer (src/tools/)** - Orchestrate operations, validate paths, call core logic with proper MCP error handling
3. **Core Logic Layer (src/core/)** - Validator (Zod schemas), Editor (atomic editing engine), Reporter (result formatting)
4. **File System Layer** - Node.js fs/promises with atomic write pattern (temp file + rename)

**Critical patterns:**
- **Temp-file-then-rename for atomicity** - Write to `.filename.hash.tmp`, then fs.rename() which is atomic on POSIX
- **Two-phase commit for multi-file** - Read all, validate all, transform all in memory, write all (with rollback on failure)
- **Fail-fast validation** - Check schema -> paths -> edit matches -> conflicts before any mutation
- **Structured error responses** - Return { content: [...], isError: true } not thrown exceptions

### Critical Pitfalls

Top risks identified from MCP security research, file atomicity patterns, and real-world bug reports from Claude Code and Eclipse.

1. **False atomicity through sequential operations** - Developers assume read -> transform -> write is atomic but it's not. File can be modified between operations. Prevention: use write-then-rename pattern, verify file unchanged between read and write.

2. **Path traversal vulnerabilities** - User paths with `../` or symlinks expose SSH keys, AWS credentials. Prevention: always path.resolve(), verify resolved path starts with allowed directory AFTER resolution, resolve symlinks and check real path.

3. **String matching ambiguity (non-unique old_string)** - old_string appears multiple times but replace_all: false. Which occurrence gets replaced is undefined. Prevention: count occurrences before editing, fail if matches > 1 for non-replace_all.

4. **Edit ordering dependencies and overlaps** - Earlier edits change content causing later edits' old_string to no longer match. Prevention: detect overlaps, validate all edits against original content before applying any, document sequential application order.

5. **Improper MCP error response format** - Throwing exceptions crashes server or prevents LLM from seeing errors. Prevention: wrap all handlers in try/catch, return { content: [...], isError: true }, provide actionable messages for LLM recovery.

## Implications for Roadmap

Based on architectural dependencies and pitfall analysis, implementation should follow this phase structure:

### Phase 1: Core Single-File Editing
**Rationale:** Foundation for everything else. Must be correct before building multi-file operations. Addresses the highest-risk pitfalls (false atomicity, edit ordering).
**Delivers:** `multi_edit` tool with full atomicity guarantees
**Addresses:**
- Single-file multi-edit (table stakes)
- Exact string matching (table stakes)
- Non-unique match detection (table stakes)
- Replace all option (table stakes)
- Clear error messages (table stakes)
**Avoids:** False atomicity (temp-file-then-rename), edit ordering bugs (sequential validation), improper error format (structured responses)
**Components:** src/core/editor.ts (applyEdits function), src/core/validator.ts (enhance schemas), src/tools/multi-edit.ts (wire up handler)

### Phase 2: Safety and Validation
**Rationale:** Security and usability layer. Must be in place before exposing to users. Prevents path traversal (critical security risk).
**Delivers:** Production-ready single-file tool with comprehensive validation
**Addresses:**
- Path validation (table stakes - security)
- File existence validation (table stakes)
- Dry-run mode (table stakes - risk mitigation)
- Input edge cases (moderate pitfall #9)
**Avoids:** Path traversal vulnerabilities (fix isAbsolutePath for Windows), verbose responses (token-conscious output)
**Components:** src/core/validator.ts (path validation), src/core/reporter.ts (result formatting), enhance error messages

### Phase 3: Multi-File Atomicity
**Rationale:** Key differentiator once foundation is solid. Highest complexity due to transaction semantics. Requires single-file tool working correctly.
**Delivers:** `multi_edit_files` tool with cross-file atomicity and rollback
**Addresses:**
- Multi-file atomic edits (competitive differentiator)
- Backup files (competitive - recovery)
**Avoids:** Incomplete rollback (maintain file states, restore all on any failure)
**Components:** src/tools/multi-edit-files.ts (two-phase commit pattern), backup creation logic
**Uses:** write-file-atomic for each file, in-memory state tracking for rollback

### Phase 4: Enhanced Diagnostics
**Rationale:** Polish and production-readiness. Better error context helps LLM recover from failures.
**Delivers:** Improved dry-run output, match context, line number reporting
**Addresses:**
- Overlap/conflict detection (competitive)
- Match context in errors (competitive)
- Edit result summary (competitive)
**Avoids:** Poor dry-run output (minimal preview), insufficient error context
**Components:** src/core/reporter.ts enhancements, conflict detection in validator

### Phase Ordering Rationale

- **Phase 1 before Phase 3**: Multi-file operations depend on single-file atomicity working correctly. Cannot build transaction layer without solid foundation.
- **Phase 2 before exposing**: Security (path traversal) and validation must be in place before any user-facing release. These are production blockers.
- **Phase 4 last**: Diagnostics and polish are valuable but not blocking. Can iterate based on user feedback.
- **Atomic writes first**: The temp-file-then-rename pattern (Phase 1) is the foundation that prevents all partial-state corruption scenarios.

### Research Flags

**Phases likely needing deeper research during planning:**
- None - This domain is well-covered by research. All phases have clear implementation patterns from official docs and battle-tested libraries.

**Phases with standard patterns (skip research-phase):**
- **Phase 1-4**: All phases. MCP SDK is well-documented, atomic write patterns are industry-standard, Zod validation is straightforward. Implementation can proceed directly from this research.

**Note for implementation:** Focus research effort on testing strategy for atomic operations. The memfs unit tests are fast but may not perfectly simulate atomic rename semantics. Integration tests with real filesystem in temp directories are critical for Phase 1 and Phase 3.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official MCP SDK docs, write-file-atomic has 97M+ weekly downloads, Vitest+memfs is proven pattern |
| Features | HIGH | Verified against Claude's Edit tool docs, MCP filesystem server schemas, clear differentiation identified |
| Architecture | HIGH | Patterns verified against MCP SDK docs, Node.js best practices, industry-standard atomic write pattern |
| Pitfalls | HIGH | Sourced from Snyk security research, real bug reports (Claude Code #3309), MCP error handling guides |

**Overall confidence:** HIGH

### Gaps to Address

While research confidence is high, these areas need attention during implementation:

- **Windows path handling**: Current isAbsolutePath only checks `startsWith('/')` - needs `path.isAbsolute()` for Windows compatibility (C:\). Fix in Phase 2.
- **Encoding detection**: Research assumes UTF-8 but real files vary (UTF-16, Latin-1, BOM). Need encoding detection or explicit documentation that tool is UTF-8 only. Address in Phase 2 or defer to v2.
- **Concurrent access**: Atomic writes prevent corruption but don't prevent race conditions if multiple processes edit same file. Document limitation or consider advisory locking. Decision needed in Phase 1.
- **Large file performance**: In-memory approach works for typical source files (<1MB) but may not scale to 100MB+ files. Add file size warnings or streaming in future if needed. Monitor in production, not blocking for MVP.

## Sources

### Primary (HIGH confidence)
- [MCP TypeScript SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk) - Tool registration patterns, error handling semantics
- [MCP Specification - Tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) - Protocol-level error handling (isError flag)
- [write-file-atomic GitHub](https://github.com/npm/write-file-atomic) - Atomic write implementation, edge case handling
- [Vitest File System Mocking](https://vitest.dev/guide/mocking/file-system) - Testing patterns with memfs
- [Claude Text Editor Tool - Anthropic Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/text-editor-tool) - Comparison baseline for features

### Secondary (MEDIUM confidence)
- [MCPcat Error Handling Guide](https://mcpcat.io/guides/error-handling-custom-mcp-servers/) - Best practices for structured errors
- [Better MCP Error Responses - Alpic AI](https://alpic.ai/blog/better-mcp-tool-call-error-responses-ai-recover-gracefully) - LLM recovery patterns
- [Snyk: Building Secure MCP Servers](https://snyk.io/articles/building-secure-mcp-servers/) - Security patterns, path traversal prevention
- [Mock fs with Vitest and memfs](https://kschaul.com/til/2024/06/26/mock-fs-with-vitest-and-memfs/) - Testing setup

### Tertiary (LOW confidence)
- [Claude Code Edit Tool Issues](https://github.com/anthropics/claude-code/issues/3309) - Real-world string matching bugs
- [Eclipse Overlapping Edits Bug](https://bugs.eclipse.org/bugs/show_bug.cgi?id=535536) - Edit ordering pitfalls
- Node.js transaction patterns for multi-file operations - No standard library; custom implementation needed

---
*Research completed: 2026-02-05*
*Ready for roadmap: yes*
