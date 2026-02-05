# Phase 1: Core Editor Engine - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the core `applyEdits` function that applies multiple string replacements to a single file with atomic guarantees. This is the editing engine that tool handlers will call. The function reads a file, applies a sequence of find-and-replace operations, and writes the result atomically using temp-file-then-rename pattern.

</domain>

<decisions>
## Implementation Decisions

### Match Behavior
- **Byte-exact matching** - spaces, tabs, newlines all matter; no normalization
- **Case-sensitive by default** - support optional `case_insensitive` flag per edit
- **UTF-8 only** - assume all files are UTF-8, fail on invalid encoding
- **No BOM handling** - simple UTF-8 without BOM detection

### Non-Unique Handling
- **Error with count and line numbers** when old_string matches multiple times (and replace_all=false)
- Error format: "Found N matches at lines X, Y, Z"
- **replace_all flag at both levels** - per-call default, per-edit override
- **Default: single replace** (replace_all: false) - safer to require explicit flag for mass replacement
- **Zero matches is an error** even when replace_all=true - something unexpected happened
- **Report replacement count** on success when replace_all=true ("Replaced 5 occurrences")
- **Allow no-op edits** - if old_string equals new_string, allow silently (0 effective changes)

### Error Detail Level
- **Show search string + suggestion** when not found - help LLM understand what went wrong
- **Line numbers only** for non-unique errors (not full context snippets)
- **Specific error + recovery hint** for file system errors ("File not found: /path. Check that file exists.")
- **Include failed edit with index** - "Edit 3 of 5 failed: ..."

### Edit Validation Strategy
- **Validate all edits upfront** before applying any
- **Sequential simulation** - validate edit N against content after edits 1 to N-1 would apply
- **Report first failure only** - stop validation at first invalid edit
- This ensures atomicity: if validation passes, the entire operation will succeed

### Claude's Discretion
- Empty old_string handling (reject vs allow as insert)
- Exact error message wording
- Internal implementation details (temp file naming, etc.)

</decisions>

<specifics>
## Specific Ideas

- Sequential simulation is key for atomicity - we know the whole operation succeeds before touching disk
- Error messages should help the LLM retry intelligently (recovery hints)
- The safer default (require unique match) prevents accidental mass replacements

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-core-editor-engine*
*Context gathered: 2026-02-05*
