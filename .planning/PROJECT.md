# MCP Multi-Edit Server

## What This Is

A production-quality MCP server providing atomic multi-edit capabilities for Claude Code. Enables multiple find-and-replace operations in a single tool call, reducing context usage and increasing delivery speed. Published as `@anthropic-community/eais-mcp-multi-edit` on npm.

## Core Value

**Atomicity**: All edits in a tool call succeed or none apply. Files are never left in a partial state.

## Requirements

### Validated

- ✓ TypeScript project structure with strict mode — existing
- ✓ MCP SDK integration with stdio transport — existing
- ✓ Tool schemas defined (multi_edit, multi_edit_files) — existing
- ✓ Zod validation schemas for input validation — existing
- ✓ Type definitions for all data structures — existing
- ✓ Basic utility functions (path validation, conflict detection) — existing
- ✓ Test infrastructure with Vitest — existing

### Active

- [ ] Core applyEdits function with atomic guarantees
- [ ] Single-file multi_edit tool handler
- [ ] Multi-file multi_edit_files tool handler
- [ ] Dry-run preview mode
- [ ] Replace-all flag per edit operation
- [ ] Clear, actionable error messages
- [ ] Backup file creation (.bak)
- [ ] Overlapping edit conflict detection
- [ ] 90%+ test coverage
- [ ] npm publishing ready (README, package.json metadata)

### Out of Scope

- Claude Desktop optimization — primary target is Claude Code
- Real-time file watching — MCP tools are invoked on-demand
- Git integration — edits are file-level, version control is user's concern
- GUI/web interface — CLI/MCP only

## Context

The project foundation is complete: types, validation, tool schemas, and test stubs are in place. The core implementation work is:

1. Implementing `applyEdits` in `src/core/editor.ts` (the editing engine)
2. Wiring up tool handlers in `src/tools/`
3. Writing comprehensive tests (TDD approach)
4. Documentation and npm publishing prep

The MCP server structure already handles request routing and response formatting.

## Constraints

- **Tech stack**: TypeScript 5.4+, Node.js 20+, @modelcontextprotocol/sdk
- **Testing**: TDD with Vitest, 90%+ coverage requirement
- **Package**: @anthropic-community/eais-mcp-multi-edit on npm public registry
- **License**: MIT

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Stdio transport only | MCP standard, works with Claude Code | — Pending |
| Zod for validation | Type-safe runtime validation, good error messages | — Pending |
| TDD approach | CLAUDE.md requirement, ensures reliability | — Pending |
| Atomicity-first | Core value prop, prevents partial file corruption | — Pending |

---
*Last updated: 2026-02-05 after initialization*
