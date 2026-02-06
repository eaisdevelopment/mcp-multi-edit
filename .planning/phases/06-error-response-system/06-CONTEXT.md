# Phase 6: Error Response System - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

All failures return structured, actionable error information for LLM recovery. Covers error taxonomy, response shape, recovery hints, and contextual information in errors. Does not add new tool capabilities or change success-path behavior.

</domain>

<decisions>
## Implementation Decisions

### Error taxonomy
- Claude's discretion on granularity (fine-grained codes vs grouped categories)
- Claude's discretion on validation vs runtime error structure
- Per-edit status: when multiple edits in one call and one fails, response includes per-edit status (edits 1-2 would succeed, edit 3 failed, edits 4-5 not attempted)
- Errors include a retryable/cause indicator distinguishing "your fault" (bad input — retryable with corrected input) from "not your fault" (disk full, permission denied — not retryable by fixing the edit)

### Recovery hints
- General guidance, not prescriptive instructions (e.g., "Check for whitespace differences" not "Try changing old_string to 'xyz'")
- When relevant for match failures, hint includes suggestion to re-read the file for current content
- No fuzzy/closest-match suggestions — just show surrounding context and let LLM figure it out
- Structured as array of suggestion strings, not a single string

### Context in errors
- Match-failure errors include 10-15 lines of surrounding file content
- Context snippets use raw content without line numbers (easier to copy-paste for retry)
- Ambiguous matches (old_string found multiple times) show ALL match locations with surrounding context
- Every error includes file_path and edit_index (0-based) for precise correlation

### Error response shape
- Error JSON lives inside MCP content text field as stringified JSON (standard MCP pattern with isError:true)
- Machine-readable error_code string alongside human-readable message (e.g., error_code: "MATCH_NOT_FOUND")
- Per-edit status uses minimal approach: only list failed/skipped edits, absence means success

### Claude's Discretion
- Error code taxonomy and naming conventions
- Whether success responses adopt the same JSON envelope or keep current format
- Per-edit status array structure details
- Exact context window positioning logic

</decisions>

<specifics>
## Specific Ideas

- Per-edit status was specifically requested to include "would succeed", "failed", and "not attempted" states
- User wants blame attribution: retryable (user error) vs non-retryable (system error)
- Recovery hints as array allows LLM to pick the most relevant suggestion

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-error-response-system*
*Context gathered: 2026-02-06*
