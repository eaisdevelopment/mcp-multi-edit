# Phase 2: Single-File Tool Wiring - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the multi_edit MCP tool handler to invoke the Phase 1 editor engine and return structured JSON responses. Claude can list tools, call multi_edit, and receive success/error responses. Multi-file operations, validation layer, and dry-run mode are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Response shape
- Detailed responses: per-edit confirmation with occurrence counts
- Success response includes: success flag, edits_applied count, file_path, per-edit status (matched, occurrences replaced)
- Optional `include_content` flag: when true, response includes full final file content
- When `include_content` is false/omitted, no file content in response (Claude can Read if needed)

### Error presentation
- Include context snippet in match errors — show surrounding content to help Claude understand mismatch
- Recovery hints for common errors (match failures, permission denied, file not found)
- For multi-edit failures: "Edit N of M failed: reason" — show position of failed edit
- Atomicity enforced: if any edit fails, none apply, file unchanged

### Claude's Discretion
- Progress feedback: per-edit details vs summary, occurrence counts, line numbers
- Input handling: path normalization, empty edits array behavior, replace_all default
- Exact response JSON structure within the constraints above
- MCP protocol conventions and best practices

</decisions>

<specifics>
## Specific Ideas

- Error context snippets: ~50 chars around expected match location
- Recovery hints should be actionable: "Read the file to see current content, then retry with correct old_string"
- Response should help Claude self-correct without additional round-trips where practical

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-single-file-tool-wiring*
*Context gathered: 2026-02-05*
