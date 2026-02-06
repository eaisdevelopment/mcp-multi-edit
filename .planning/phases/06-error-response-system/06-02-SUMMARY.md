---
phase: 06-error-response-system
plan: 02
subsystem: error-handler-retrofit
tags: [error-handling, error-envelope, handler-retrofit, consistency]

dependency-graph:
  requires: [06-01]
  provides: [unified-error-responses, no-bare-error-objects]
  affects: [07-multi-file-tool, 08-integration-testing]

tech-stack:
  added: []
  patterns: [error-envelope-everywhere, classifyError-pattern, error-code-from-message]

key-files:
  created: []
  modified:
    - src/tools/multi-edit.ts
    - src/tools/multi-edit-files.ts
    - src/index.ts

decisions:
  - id: classify-error-for-catch-blocks
    description: "Catch blocks use classifyError() to map exceptions to ErrorCode + message"
    rationale: "Ensures stack traces never leak; provides structured error codes from raw exceptions"
  - id: classify-error-code-from-message-helper
    description: "Added classifyErrorCodeFromMessage in multi-edit-files.ts for result.error strings"
    rationale: "Per-file edit failures return string errors; need to classify into ErrorCode for envelope"
  - id: pass-edits-for-per-edit-status
    description: "multi-edit.ts now passes input.edits to formatMultiEditResponse"
    rationale: "Enables per-edit status tracking (failed/skipped) in ErrorEnvelope for edit failures"

metrics:
  duration: 4 min
  completed: 2026-02-06
---

# Phase 6 Plan 2: Handler Error Retrofit Summary

Retrofitted all 11 direct error return points across 3 handler files to use the canonical ErrorEnvelope from errors.ts, plus 2 via formatMultiEditResponse in reporter.ts.

## One-liner

All 13 error paths across multi-edit.ts, multi-edit-files.ts, and index.ts now produce ErrorEnvelope via createErrorEnvelope with proper error codes, retryable flags, and recovery hints.

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Retrofit multi-edit.ts and multi-edit-files.ts handlers | f9445f2 | 8 error paths in 2 tool handlers replaced with createErrorEnvelope |
| 2 | Retrofit index.ts catch-all error handlers | a3560a3 | 3 error paths in server entry point replaced with createErrorEnvelope |

## What Was Built

### multi-edit.ts (3 error paths)
- **Validation failure**: Uses `createErrorEnvelope` with `VALIDATION_FAILED` and maps validation errors to recovery_hints
- **Edit failure via formatMultiEditResponse**: Now passes `input.edits` (6th param) for per-edit status tracking
- **Catch block**: Uses `classifyError()` to map exceptions to structured error code + message

### multi-edit-files.ts (5 error paths)
- **Zod validation failure**: Uses `createErrorEnvelope` with `VALIDATION_FAILED`
- **Relative path check**: Uses `createErrorEnvelope` with `RELATIVE_PATH` and includes offending file_path
- **Per-file edit failure**: Uses `classifyErrorCodeFromMessage()` helper to detect error type from result.error string
- **Per-file exception**: Uses `classifyError()` to map caught exception to structured error
- **Outer catch**: Uses `classifyError()` for unexpected top-level failures

### index.ts (3 error paths)
- **Not implemented**: Uses `createErrorEnvelope` with `NOT_IMPLEMENTED`
- **Unknown tool**: Uses `createErrorEnvelope` with `UNKNOWN_TOOL`
- **Outer catch**: Uses `classifyError()` to prevent stack trace leakage

### Imports Removed
- `createErrorResult` removed from multi-edit.ts (no longer needed)
- `createFilesErrorResult` removed from multi-edit-files.ts (replaced by createErrorEnvelope)

### Imports Added
- `createErrorEnvelope`, `classifyError` added to all 3 handler files
- `ErrorCode` type added to multi-edit-files.ts

## Decisions Made

1. **classifyError for catch blocks** - All catch blocks use classifyError() to extract message without stack trace
2. **classifyErrorCodeFromMessage helper** - Private helper in multi-edit-files.ts maps result.error strings to ErrorCode
3. **Pass edits for per-edit status** - multi-edit.ts passes input.edits to formatMultiEditResponse for edit_status generation

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npm run build` passes with zero errors
- Zero bare `{ error: "..." }` objects in any src/ file
- All error responses use `createErrorEnvelope`
- Every error return has `isError: true`
- No `.stack` references in tools/ or index.ts
- All 42 existing tests pass (29 editor + 13 validator)

## Error Path Inventory (Final)

| # | File | Error Path | Error Code |
|---|------|-----------|------------|
| 1 | multi-edit.ts | Validation failure | VALIDATION_FAILED |
| 2 | multi-edit.ts | Edit failure (via reporter) | Classified from message |
| 3 | multi-edit.ts | Catch block | Classified from exception |
| 4 | multi-edit-files.ts | Zod validation failure | VALIDATION_FAILED |
| 5 | multi-edit-files.ts | Relative path check | RELATIVE_PATH |
| 6 | multi-edit-files.ts | Per-file edit failure | Classified from message |
| 7 | multi-edit-files.ts | Per-file exception | Classified from exception |
| 8 | multi-edit-files.ts | Outer catch | Classified from exception |
| 9 | index.ts | Not implemented | NOT_IMPLEMENTED |
| 10 | index.ts | Unknown tool | UNKNOWN_TOOL |
| 11 | index.ts | Outer catch | Classified from exception |
| 12 | reporter.ts | MATCH_NOT_FOUND path | MATCH_NOT_FOUND |
| 13 | reporter.ts | AMBIGUOUS_MATCH path | AMBIGUOUS_MATCH |

## Next Phase Readiness

Phase 6 (Error Response System) is now complete. All error paths produce the canonical ErrorEnvelope shape. The system is ready for:
- Phase 7 (Multi-File Tool) - will use createErrorEnvelope for new tool errors
- Phase 8 (Integration Testing) - can verify error response shapes

## Self-Check: PASSED
