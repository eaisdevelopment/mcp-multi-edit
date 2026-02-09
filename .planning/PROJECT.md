# MCP Multi-Edit Server

## What This Is

A production-quality MCP server providing atomic multi-edit capabilities for Claude Code and Claude Desktop. Enables multiple find-and-replace operations in a single tool call with cross-file atomicity, reducing context usage and increasing delivery speed. Published as `@essentialai/mcp-multi-edit` on npm.

## Core Value

**Atomicity**: All edits in a tool call succeed or none apply. Files are never left in a partial state.

## Requirements

### Validated

- ✓ Core applyEdits function with atomic guarantees -- v1.0
- ✓ Single-file multi_edit tool handler -- v1.0
- ✓ Multi-file multi_edit_files tool handler with rollback -- v1.0
- ✓ Dry-run preview mode -- v1.0
- ✓ Replace-all flag per edit operation -- v1.0
- ✓ LLM-optimized error messages with recovery hints -- v1.0 (ErrorEnvelope with 18 error codes)
- ✓ Backup file creation (.bak) with permission preservation -- v1.0
- ✓ Overlapping edit conflict detection -- v1.0
- ✓ 98.52% test coverage (264 tests) -- v1.0
- ✓ npm published as @essentialai/mcp-multi-edit@0.1.0 -- v1.0

### Active

(None -- awaiting next milestone definition)

### Out of Scope

- Claude Desktop optimization -- primary target is Claude Code
- Real-time file watching -- MCP tools are invoked on-demand
- Git integration -- edits are file-level, version control is user's concern
- GUI/web interface -- CLI/MCP only
- AST-aware editing -- contradicts string-based design
- Fuzzy matching -- contradicts precision-first philosophy
- Line-based addressing -- v2 consideration (ENH-01)
- Regex pattern support -- v2 consideration (ENH-02)

## Context

Shipped v1.0 with 6,135 LOC TypeScript across 11 phases in 5 days.
Tech stack: TypeScript 5.4+, Node.js 20+, @modelcontextprotocol/sdk, Zod, Vitest.
Package: @essentialai/mcp-multi-edit@0.1.0 on npm public registry.
License: PolyForm Noncommercial 1.0.0.
Repository: https://github.com/eaisdevelopment/mcp-multi-edit

Architecture:
- `src/server.ts` -- MCP server with tool routing
- `src/core/editor.ts` -- File editing engine (applyEdits, atomicWrite)
- `src/core/validator.ts` -- 4-layer validation pipeline
- `src/core/errors.ts` -- ErrorEnvelope system with 18 error codes
- `src/core/reporter.ts` -- Response formatting with diff preview
- `src/tools/multi-edit.ts` -- Single-file tool handler
- `src/tools/multi-edit-files.ts` -- Multi-file handler with 3-phase pipeline and rollback

## Constraints

- **Tech stack**: TypeScript 5.4+, Node.js 20+, @modelcontextprotocol/sdk
- **Testing**: TDD with Vitest, 90%+ coverage enforced via vitest.config.ts thresholds
- **Package**: @essentialai/mcp-multi-edit on npm public registry
- **License**: PolyForm Noncommercial 1.0.0

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Stdio transport only | MCP standard, works with Claude Code | ✓ Good |
| Zod for validation | Type-safe runtime validation, good error messages | ✓ Good |
| TDD approach | Ensures reliability, achieved 98.52% coverage | ✓ Good |
| Atomicity-first | Core value prop, prevents partial file corruption | ✓ Good |
| ErrorEnvelope canonical shape | Consistent structure for LLM parsing and retry logic | ✓ Good |
| Temp-file-then-rename writes | Prevents partial file states, avoids EXDEV errors | ✓ Good |
| 4-layer validation order | Zod -> path -> duplicates -> existence (fastest first) | ✓ Good |
| Mandatory backups for multi-file | Enables rollback mechanism, safety-first | ✓ Good |
| Server factory extraction | Enables InMemoryTransport testing without stdio | ✓ Good |
| PolyForm Noncommercial license | Replaces MIT per user decision | ✓ Good |
| @essentialai scope on npm | User decision for package identity | ✓ Good |

---
*Last updated: 2026-02-09 after v1.0 milestone*
