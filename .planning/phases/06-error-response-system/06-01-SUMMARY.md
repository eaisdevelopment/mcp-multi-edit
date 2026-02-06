---
phase: 06-error-response-system
plan: 01
subsystem: error-infrastructure
tags: [error-handling, types, error-codes, error-envelope, context-extraction]

dependency-graph:
  requires: [01-core-editor-engine, 02-single-file-tool-wiring]
  provides: [error-envelope-types, error-classification, context-extraction, edit-status-tracking]
  affects: [06-02, 07-multi-file-tool, 08-integration-testing]

tech-stack:
  added: []
  patterns: [error-envelope-pattern, error-code-taxonomy, retryable-classification]

key-files:
  created:
    - src/core/errors.ts
  modified:
    - src/types/index.ts
    - src/core/reporter.ts

decisions:
  - id: error-envelope-as-canonical
    description: "ErrorEnvelope is the single canonical error shape for all error responses"
    rationale: "Consistent structure enables LLM parsing and retry logic"
  - id: retryable-classification
    description: "Validation and match errors are retryable; filesystem errors are not"
    rationale: "Distinguishes user-fixable input errors from infrastructure failures"
  - id: success-path-unchanged
    description: "SuccessResponse format kept as-is; only error path uses ErrorEnvelope"
    rationale: "No need to change working success format; error path needed restructuring"
  - id: optional-edits-param
    description: "Added optional edits param to formatMultiEditResponse for edit_status"
    rationale: "Backward compatible - callers can opt in to per-edit status tracking"

metrics:
  duration: 3 min
  completed: 2026-02-06
---

# Phase 6 Plan 1: Error Types and Infrastructure Summary

Defined the canonical error types and built the unified error infrastructure (errors.ts), then refactored reporter.ts to produce ErrorEnvelope instead of ad-hoc ErrorResponse.

## One-liner

ErrorEnvelope type with error code taxonomy, retryable classification, 10-15 line context extraction, and per-edit status tracking via errors.ts module.

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Add error types and create errors.ts module | 89506e7 | ErrorCode, ErrorEnvelope, EditStatusEntry, MatchLocation, ErrorContext types; errors.ts with 8 exports |
| 2 | Refactor reporter.ts to use error envelope | 946a0e1 | Removed ErrorResponse/getRecoveryHint/extractContextSnippet; formatMultiEditResponse returns ErrorEnvelope |

## What Was Built

### Error Type System (src/types/index.ts)
- **ErrorCode** - 19 error codes across 4 categories: validation (6), match (2), filesystem (8), other (3)
- **EditStatusEntry** - Per-edit status for failed/skipped edits (success = absence)
- **MatchLocation** - Line number + snippet for ambiguous match locations
- **ErrorContext** - Context snippet and/or match locations attached to errors
- **ErrorEnvelope** - Canonical error shape with success:false, error_code, message, retryable, recovery_hints, context, edit_status, backup_path

### Error Infrastructure (src/core/errors.ts)
- **RETRYABLE_CODES** - Set of 8 retryable error codes (validation + match errors)
- **isRetryable()** - Check if error code is retryable
- **classifyError()** - Classify caught Error/ErrnoException into error code + message
- **getRecoveryHints()** - General guidance strings per error code (array, not single string)
- **extractFileContext()** - 10-15 lines of raw context for match-not-found errors
- **extractMatchLocations()** - All match locations with 7-line context each, capped at 5
- **createErrorEnvelope()** - Factory function, omits undefined fields, auto-computes retryable
- **buildEditStatus()** - Per-edit status: failed entry + skipped entries for subsequent edits

### Reporter Refactor (src/core/reporter.ts)
- Removed: `ErrorResponse` interface, `getRecoveryHint()`, `extractContextSnippet()`
- Updated: `formatMultiEditResponse()` returns `ErrorEnvelope` on error paths
- Added: `classifyErrorFromMessage()` (private) for error string classification
- Added: Optional `edits` parameter for per-edit status tracking
- Unchanged: All success-path functions, `generateDiffPreview`, `truncateForDisplay`

## Decisions Made

1. **ErrorEnvelope as canonical shape** - All error responses use this single type
2. **Retryable classification** - Validation/match errors retryable, FS errors not
3. **Success path unchanged** - SuccessResponse keeps current format
4. **Optional edits param** - Backward-compatible addition to formatMultiEditResponse

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- Build compiles cleanly (zero errors)
- All 42 existing tests pass
- errors.ts exports all 8 items
- types/index.ts contains all 5 new types
- reporter.ts no longer exports getRecoveryHint or extractContextSnippet
- No circular imports between errors.ts and reporter.ts

## Next Phase Readiness

Error infrastructure is ready for consumption by tool handlers. The `multi-edit.ts` handler already calls `formatMultiEditResponse` with 5 args and will work unchanged. To enable per-edit status, callers can pass the optional 6th `edits` parameter.

## Self-Check: PASSED
