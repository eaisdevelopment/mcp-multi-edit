# Roadmap: MCP Multi-Edit Server

## Overview

This roadmap transforms the existing foundation (types, validation schemas, tool schemas) into a production-ready MCP server for atomic multi-file editing. The journey progresses from core editing logic through safety layers, error handling, multi-file support, comprehensive testing, and finally npm publishing. Each phase delivers verifiable capability while maintaining the core value: atomicity - all edits succeed or none apply.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Core Editor Engine** - Implement applyEdits with atomic guarantees
- [x] **Phase 2: Single-File Tool Wiring** - Wire multi_edit tool to editor engine
- [x] **Phase 3: Validation Layer** - Path validation and conflict detection
- [x] **Phase 4: Dry-Run Mode** - Preview changes without writing
- [x] **Phase 5: Backup System** - Create .bak files before editing
- [x] **Phase 6: Error Response System** - Structured errors with recovery hints
- [x] **Phase 7: Multi-File Operations** - Cross-file atomic editing with rollback
- [x] **Phase 8: Unit Testing** - Editor and validator test coverage
- [ ] **Phase 9: Integration Testing** - MCP server and edge case tests
- [ ] **Phase 10: Coverage Completion** - Achieve 90%+ code coverage
- [ ] **Phase 11: Publishing** - npm package preparation and release

## Phase Details

### Phase 1: Core Editor Engine
**Goal**: Users can apply multiple string replacements to a single file with atomic guarantees
**Depends on**: Nothing (first phase - builds on existing types/schemas)
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07, SAFE-05
**Success Criteria** (what must be TRUE):
  1. User can pass file path and edit array to applyEdits function and receive modified content
  2. Edit operation fails with clear error when old_string is not found in file
  3. Edit operation fails with clear error when old_string matches multiple locations (unless replace_all is true)
  4. Edits apply sequentially in array order, with later edits seeing results of earlier edits
  5. File is written atomically using temp-file-then-rename pattern (no partial states)
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md - Core applyEdits implementation with TDD (sequential simulation, error handling)
- [x] 01-02-PLAN.md - Atomic file I/O (UTF-8 validation, temp-then-rename write)

### Phase 2: Single-File Tool Wiring
**Goal**: Claude can invoke multi_edit tool and receive structured results
**Depends on**: Phase 1
**Requirements**: MCP-01, MCP-03, MCP-04
**Success Criteria** (what must be TRUE):
  1. Claude client can list available tools and see multi_edit with correct schema
  2. Claude client can call multi_edit and receive structured JSON response
  3. Tool returns success=true with edits_applied count when all edits succeed
**Plans**: 1 plan

Plans:
- [x] 02-01-PLAN.md - Wire handler to MCP server with enhanced response formatting

### Phase 3: Validation Layer
**Goal**: Invalid inputs are rejected before any file operations occur
**Depends on**: Phase 2
**Requirements**: SAFE-02, SAFE-03
**Success Criteria** (what must be TRUE):
  1. Tool rejects relative paths with clear error message explaining absolute path requirement
  2. Tool detects and rejects overlapping edits that would conflict with each other
  3. Validation errors return before any file read or write operations
**Plans**: 1 plan

Plans:
- [x] 03-01-PLAN.md - Path validation, duplicate detection, and full validation wiring

### Phase 4: Dry-Run Mode
**Goal**: Users can preview what edits would change without modifying files
**Depends on**: Phase 3
**Requirements**: SAFE-01
**Success Criteria** (what must be TRUE):
  1. User can set dry_run=true and see what would change without file modification
  2. Dry-run returns same success/failure status as real run would
  3. Original file content is unchanged after dry-run operation
**Plans**: 1 plan

Plans:
- [x] 04-01-PLAN.md — Enhance dry-run response with DRY RUN label and diff preview

### Phase 5: Backup System
**Goal**: Original file content is preserved before edits are applied
**Depends on**: Phase 4
**Requirements**: SAFE-04
**Success Criteria** (what must be TRUE):
  1. A .bak file is created with original content before applying edits
  2. Backup file can be used to manually restore original content if needed
  3. Backup creation failure prevents edit operation from proceeding
**Plans**: 1 plan

Plans:
- [x] 05-01-PLAN.md — Rename create_backup to backup, implement backup-before-edits with permission preservation

### Phase 6: Error Response System
**Goal**: All failures return structured, actionable error information for LLM recovery
**Depends on**: Phase 5
**Requirements**: ERR-01, ERR-02, ERR-03, ERR-04, ERR-05
**Success Criteria** (what must be TRUE):
  1. All failure cases return isError: true in MCP response
  2. Error responses follow consistent JSON schema with message and details
  3. Error messages include recovery_hint field guiding LLM to retry correctly
  4. Match failures include surrounding context showing where in file the problem is
  5. Stack traces are never exposed in error responses
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md -- Error types, errors.ts module, and reporter.ts refactor
- [x] 06-02-PLAN.md -- Retrofit all handler error paths to use ErrorEnvelope

### Phase 7: Multi-File Operations
**Goal**: Users can edit multiple files atomically with rollback on failure
**Depends on**: Phase 6
**Requirements**: EDIT-08, EDIT-09, MCP-02
**Success Criteria** (what must be TRUE):
  1. Claude client can call multi_edit_files with array of file specifications
  2. All files are edited successfully, or all remain unchanged (cross-file atomicity)
  3. If any file edit fails, previously edited files are rolled back to original state
  4. Result includes per-file status showing which files succeeded/failed
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md -- Extend types and build multi-file validation pipeline
- [x] 07-02-PLAN.md -- Multi-file handler with 3-phase pipeline, rollback, and wiring

### Phase 8: Unit Testing
**Goal**: Core logic is verified through isolated unit tests
**Depends on**: Phase 7
**Requirements**: TEST-01, TEST-02
**Success Criteria** (what must be TRUE):
  1. Unit tests verify editor.ts string replacement logic in isolation
  2. Unit tests verify validator.ts Zod schemas accept valid input and reject invalid input
  3. Tests use mocked filesystem (memfs) for speed and isolation
  4. All unit tests pass on CI
**Plans**: 2 plans

Plans:
- [x] 08-01-PLAN.md -- Pure logic tests for editor.ts and validator.ts (no mocking)
- [x] 08-02-PLAN.md -- Filesystem-dependent tests with memfs for editor.ts IO and validator.ts async

### Phase 9: Integration Testing
**Goal**: Full MCP server workflow and edge cases are verified
**Depends on**: Phase 8
**Requirements**: TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. Integration tests verify complete MCP request/response cycle
  2. Edge cases are tested: unicode content, large files, empty edits array
  3. Tests verify actual file operations on real filesystem (temp directories)
  4. All integration tests pass on CI
**Plans**: 2 plans

Plans:
- [ ] 09-01-PLAN.md -- Server factory extraction, test helpers, and MCP protocol integration tests
- [ ] 09-02-PLAN.md -- Edge case tests (unicode, large files, empty edits, line endings, match behavior)

### Phase 10: Coverage Completion
**Goal**: Test suite achieves production-quality coverage threshold
**Depends on**: Phase 9
**Requirements**: TEST-05
**Success Criteria** (what must be TRUE):
  1. Code coverage report shows 90%+ line coverage
  2. Coverage gaps are documented with rationale (e.g., unreachable error branches)
  3. CI enforces coverage threshold - builds fail below 90%
**Plans**: TBD

Plans:
- [ ] 10-01: TBD

### Phase 11: Publishing
**Goal**: Package is ready for npm public registry publication
**Depends on**: Phase 10
**Requirements**: PUB-01, PUB-02, PUB-03, PUB-04
**Success Criteria** (what must be TRUE):
  1. Package is named @anthropic-community/eais-mcp-multi-edit in package.json
  2. README includes installation instructions and usage examples for Claude Code
  3. MIT license file is present in repository
  4. package.json has proper metadata: bin entry, main, types, repository, keywords
**Plans**: TBD

Plans:
- [ ] 11-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Editor Engine | 2/2 | ✓ Complete | 2026-02-05 |
| 2. Single-File Tool Wiring | 1/1 | ✓ Complete | 2026-02-05 |
| 3. Validation Layer | 1/1 | ✓ Complete | 2026-02-05 |
| 4. Dry-Run Mode | 1/1 | ✓ Complete | 2026-02-06 |
| 5. Backup System | 1/1 | ✓ Complete | 2026-02-06 |
| 6. Error Response System | 2/2 | ✓ Complete | 2026-02-06 |
| 7. Multi-File Operations | 2/2 | ✓ Complete | 2026-02-08 |
| 8. Unit Testing | 2/2 | ✓ Complete | 2026-02-09 |
| 9. Integration Testing | 0/2 | Not started | - |
| 10. Coverage Completion | 0/TBD | Not started | - |
| 11. Publishing | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-05*
*Depth: Comprehensive (11 phases)*
