# Phase 3: Validation Layer - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Reject invalid inputs before any file operations occur. All validation runs before file reads/writes. Validation is a separate layer that gates access to the editor.

</domain>

<decisions>
## Implementation Decisions

### Path validation rules
- Require absolute paths — reject relative paths with clear error
- Check file existence at validation time — reject missing files upfront
- Follow symlinks — resolve to real path and edit the target file
- Block directory traversal patterns — reject paths containing `..` segments
- No path prefix restrictions — any absolute path is valid

### Overlap detection
- Reject exact duplicate old_strings only — block if same old_string appears twice in edits for same file
- No substring overlap detection — sequential execution handles those cases naturally
- Detection happens at validation time, before any file operations

### Error message design
- Detailed verbosity — include what was received: "Invalid path: got ./foo.ts, expected absolute path"
- Always include recovery hints — every validation error has actionable guidance
- Include both edit index and content snippet for edit-level errors: "Edit 2 of 5: old_string='function foo...' is duplicate"
- Format: structured JSON with human-readable message field — machine-parseable with clear formatted text

### Validation ordering
- All schema validation runs before file existence check (minimize I/O)
- Duplicate edit detection happens at validation time
- Separate validator module — validateInput() returns errors or clean data; editor assumes valid input

### Claude's Discretion
- Fail-fast vs collect-all-errors behavior
- Exact ordering of validation checks within schema validation
- Snippet truncation length for error messages

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-validation-layer*
*Context gathered: 2026-02-05*
