# Phase 5: Backup System - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Create .bak files to preserve original file content before edits are applied. Backup enables manual restoration if needed. Backup failure prevents edit operation from proceeding.

</domain>

<decisions>
## Implementation Decisions

### Backup Location
- Same directory as original file (file.txt → file.txt.bak)
- Backup on by default, opt-out with `backup: false` parameter
- Dry-run mode DOES create backup (user chose this for restoration if they proceed later)
- If backup already exists, overwrite with fresh backup (latest original content)

### Naming Convention
- Simple .bak suffix: `file.txt` → `file.txt.bak`
- Files already ending in .bak get double extension: `file.bak` → `file.bak.bak`
- Response includes `backup_path` field showing where backup was created
- Preserve original file permissions on the backup file

### Retention Policy
- Single backup per file (overwrite existing .bak on each edit)
- Never auto-delete backups — user manually cleans up when confident
- For multi_edit_files: one .bak per file (same as single-file behavior)
- Keep backups after rollback (allows inspection of what was attempted)

### Failure Behavior
- Backup failure aborts entire operation — no edit without backup
- Error message includes specific reason: "Backup failed: Permission denied on /path/to/file.txt.bak"
- If backup succeeds but edit fails: keep backup (used for rollback restoration)
- Include `backup_path` in error response when backup succeeded but edit failed

### Claude's Discretion
- Exact implementation of permission copying (platform-specific)
- Whether to use temp-file-then-rename for backup creation (atomicity)
- Error categorization codes for backup failures

</decisions>

<specifics>
## Specific Ideas

- Dry-run creating backups was intentional — user wants backup ready before proceeding
- Backup path in both success AND error responses — always know where original is preserved

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-backup-system*
*Context gathered: 2026-02-06*
