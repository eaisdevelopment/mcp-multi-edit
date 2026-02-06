# Phase 7: Multi-File Operations - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Cross-file atomic editing with rollback. Users can edit multiple files in a single `multi_edit_files` tool call. All files are edited successfully or all remain unchanged. If any file edit fails, previously edited files are rolled back to their original state. Result includes per-file status.

</domain>

<decisions>
## Implementation Decisions

### Rollback behavior
- Backup-based rollback: create .bak for each file before editing, restore from .bak on failure
- Backups are **mandatory** for multi-file operations — `backup` parameter is ignored (always true) because backups are the rollback mechanism
- On successful rollback, .bak files are **kept** (not cleaned up) — extra safety net for user verification
- If rollback itself fails: detailed per-file rollback report showing which files were restored, which failed to restore, and .bak file paths for manual recovery

### Per-file response format
- Full detail per file: each file gets file_path, edits_applied count, edit_status array (per-edit pass/fail), backup_path — mirrors single-file multi_edit response shape
- Top-level summary alongside per-file details: total_files, files_succeeded, files_failed, total_edits
- `include_content` applies to all files when set — every file in result includes final_content

### Failure semantics
- **Fail-fast**: stop on first file failure, roll back any files already edited
- **Validate all upfront**: check all file paths, schemas, and read permissions before starting any edits — fail early with all validation errors at once
- **Report all validation errors**: collect and return all validation errors across all files so LLM can fix everything in one retry
- Error response uses ErrorEnvelope (Phase 6) with per-file error details nested inside as an array

### File ordering & limits
- Process files in exact array order — predictable, matches user intent
- No maximum file count limit — trust the caller
- Duplicate file paths rejected with validation error (upfront detection, lists the duplicates)
- Empty files array rejected with validation error — not a no-op

### Claude's Discretion
- Dry-run diff inclusion strategy across multiple files (whether to include diffs for all files or only changed files)
- Internal file processing pipeline structure
- Rollback implementation details (order of restoration, error accumulation)

</decisions>

<specifics>
## Specific Ideas

- Per-file response should mirror the single-file `multi_edit` response shape for consistency — same fields, same structure, just wrapped in an array
- ErrorEnvelope extension: nest per-file errors in the details array so LLMs can parse which file had which problem
- Upfront validation catches duplicate paths by resolving symlinks first (consistent with Phase 3 path validation)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-multi-file-operations*
*Context gathered: 2026-02-06*
