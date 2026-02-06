# Phase 5: Backup System - Research

**Researched:** 2026-02-06
**Domain:** Node.js file I/O, file permissions, backup-before-edit pattern
**Confidence:** HIGH

## Summary

Phase 5 implements a backup system that creates `.bak` files preserving original content before edits are applied. The codebase already has a partial scaffold: the `create_backup` parameter exists in types, Zod schemas, tool schemas, and `applyEdits()` has a basic 4-line backup implementation. However, this scaffold has significant gaps relative to the user's decisions: wrong default value, wrong parameter name convention, dry-run skips backup, no permission preservation, and missing `backup_path` in error responses.

The technical approach is straightforward Node.js `fs` operations. The key decisions from the user are: (a) backup defaults to ON with opt-out, (b) dry-run DOES create backup, (c) backup failure aborts the entire operation, (d) `backup_path` appears in both success and error responses. The main technical discretion area is whether to use `fs.copyFile` (atomic, fast, kernel-level) vs temp-file-then-rename for backup creation, and how to preserve permissions cross-platform.

**Primary recommendation:** Use `fs.copyFile` for the backup operation (it copies content atomically at the kernel level), then `fs.stat` + `fs.chmod` to preserve permissions. Refactor the existing scaffold rather than rewriting from scratch.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Same directory as original file (file.txt -> file.txt.bak)
- Backup on by default, opt-out with `backup: false` parameter
- Dry-run mode DOES create backup (user chose this for restoration if they proceed later)
- If backup already exists, overwrite with fresh backup (latest original content)
- Simple .bak suffix: `file.txt` -> `file.txt.bak`
- Files already ending in .bak get double extension: `file.bak` -> `file.bak.bak`
- Response includes `backup_path` field showing where backup was created
- Preserve original file permissions on the backup file
- Single backup per file (overwrite existing .bak on each edit)
- Never auto-delete backups -- user manually cleans up when confident
- For multi_edit_files: one .bak per file (same as single-file behavior)
- Keep backups after rollback (allows inspection of what was attempted)
- Backup failure aborts entire operation -- no edit without backup
- Error message includes specific reason: "Backup failed: Permission denied on /path/to/file.txt.bak"
- If backup succeeds but edit fails: keep backup (used for rollback restoration)
- Include `backup_path` in error response when backup succeeded but edit failed

### Claude's Discretion
- Exact implementation of permission copying (platform-specific)
- Whether to use temp-file-then-rename for backup creation (atomicity)
- Error categorization codes for backup failures

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

No new libraries needed. All required functionality exists in Node.js built-in `fs/promises` module.

### Core
| API | Module | Purpose | Why Standard |
|-----|--------|---------|--------------|
| `fs.copyFile` | `fs/promises` | Copy file content to backup path | Kernel-level copy, handles large files efficiently |
| `fs.stat` | `fs/promises` | Read source file permissions (mode) | Required to preserve permissions on backup |
| `fs.chmod` | `fs/promises` | Apply original permissions to backup | Cross-platform permission setter |
| `fs.writeFile` | `fs/promises` | Fallback: write content buffer to backup | Already used in existing scaffold |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fs.copyFile` | `fs.writeFile(bakPath, content)` | writeFile already has the content in memory; copyFile re-reads from disk. Since we already have content loaded, writeFile is actually more efficient for this use case. |
| temp-file-then-rename for backup | Direct `fs.writeFile` to `.bak` | Temp-then-rename adds complexity but prevents partial .bak files on crash. For backup files that are advisory (not critical system files), direct write is sufficient. |

**Revised recommendation:** Use `fs.writeFile` (not `fs.copyFile`) since we already have the original file content loaded in memory. Then `fs.stat` + `fs.chmod` to preserve permissions. This avoids an unnecessary disk re-read.

## Architecture Patterns

### Current Scaffold (What Exists)

The backup system is already partially wired in 5 locations:

```
src/types/index.ts        - create_backup field on MultiEditInput, MultiEditFilesInput
                          - backup_path field on MultiEditResult
src/core/validator.ts     - create_backup in Zod schemas (default: false)
src/core/editor.ts        - Basic backup in applyEdits() lines 317-329
src/core/reporter.ts      - backup_path surfaced in SuccessResponse
src/index.ts              - create_backup in tool input schemas
```

### What Needs to Change

**1. Parameter naming and default:**
The user decided "backup on by default, opt-out with `backup: false`". Current code uses `create_backup` defaulting to `false`. Decision needed: rename to `backup` or keep `create_backup` but change default. The user's language was "opt-out with `backup: false`" which suggests the parameter name should be `backup` (shorter, cleaner).

**Affected files for parameter rename (create_backup -> backup):**
- `src/types/index.ts` - MultiEditInput.create_backup, MultiEditFilesInput.create_backup
- `src/core/validator.ts` - Zod schema field name and default value (false -> true)
- `src/index.ts` - Tool schema property name and description
- `src/tools/multi-edit.ts` - Reference to input.create_backup
- `src/tools/multi-edit-files.ts` - Reference to input.create_backup
- `src/core/editor.ts` - Parameter name in applyEdits()

**2. Dry-run + backup interaction:**
Current code at editor.ts line 313: `if (!result.success || dryRun) { return result; }` -- this returns BEFORE backup creation. Must restructure to create backup BEFORE the dry-run early return.

**3. Backup ordering:**
Current order: Read -> Apply edits in memory -> Create backup -> Write result.
Required order: Read -> Create backup (of original) -> Apply edits in memory -> Write result.
The backup must happen BEFORE edits are applied to disk, and the backup must contain the ORIGINAL content.

**4. Permission preservation:**
Current `fs.writeFile(backupPath, content, 'utf8')` does not preserve permissions. Must add `fs.stat` + `fs.chmod`.

**5. Error response enhancement:**
Current ErrorResponse type in reporter.ts does not include `backup_path`. Must add it so that when backup succeeds but edit fails, the backup_path is reported.

### Recommended Flow (applyEdits refactored)

```
1. Read file content (already done)
2. If backup requested:
   a. Compute backup path: filePath + '.bak'
   b. Read original file permissions via fs.stat(filePath)
   c. Write original content to backup path
   d. Set backup permissions via fs.chmod(backupPath, originalMode)
   e. On failure: return error immediately, no edit proceeds
3. Apply edits in memory (already done)
4. If dry_run: return result WITH backup_path (backup was already created in step 2)
5. If edits failed: return error WITH backup_path (backup was already created in step 2)
6. Write result atomically (already done)
7. Return success WITH backup_path
```

### Backup Path Computation

```typescript
function computeBackupPath(filePath: string): string {
  return `${filePath}.bak`;
  // file.txt -> file.txt.bak
  // file.bak -> file.bak.bak (naturally handled by suffix append)
}
```

This is trivially simple -- just append `.bak`. The double-extension case (`file.bak` -> `file.bak.bak`) is handled automatically by string concatenation.

### Anti-Patterns to Avoid
- **Backup after edit:** Never create the backup after writing the edited content -- the backup must capture the original state.
- **Backup in a different directory:** The user explicitly locked "same directory as original file." Do not use temp dirs.
- **Conditional backup on dry-run:** The user explicitly chose that dry-run DOES create backup. Do not skip it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File copying | Stream-based copy | `fs.writeFile` with already-loaded content | Content is already in memory from the read step |
| Permission reading | Manual `stat` flag parsing | `stat.mode` property | Node.js provides this directly |
| Atomic backup write | Custom temp-file-rename | Direct `fs.writeFile` | Backup is advisory; partial backup on crash is acceptable vs the complexity of temp-rename for backup |
| Backup path naming | Complex naming with timestamps | Simple `${filePath}.bak` | User locked this decision |

## Common Pitfalls

### Pitfall 1: Backup After Edit (Wrong Order)
**What goes wrong:** If backup is created after the edit is written to disk, the backup contains the edited content, not the original.
**Why it happens:** The current scaffold creates backup at step 4, after edits are applied in memory but the ORDER within applyEdits matters -- backup must happen before ANY disk write.
**How to avoid:** Create backup immediately after reading the file, before any edit logic runs.
**Warning signs:** Backup file content matches the edited file instead of the original.

### Pitfall 2: Dry-Run Skipping Backup
**What goes wrong:** Current code returns early for dry-run before reaching backup creation.
**Why it happens:** Line 313 in editor.ts: `if (!result.success || dryRun) { return result; }` exits before backup at line 318.
**How to avoid:** Move backup creation before the edit application / dry-run return.
**Warning signs:** dry_run response has no backup_path field.

### Pitfall 3: Permission Preservation on macOS vs Linux
**What goes wrong:** `fs.stat().mode` includes the file type bits (e.g., regular file = 0o100644). Passing the full mode to `fs.chmod` works on both platforms, but only the permission bits (lower 12 bits) are used by chmod.
**Why it happens:** `stat.mode` includes file type + permissions. `chmod` only uses the permission portion.
**How to avoid:** Use `stat.mode & 0o7777` to extract just the permission bits, or pass `stat.mode` directly (chmod ignores type bits). Either works, but explicit masking is clearer.
**Warning signs:** No visible issue typically, but good practice for code clarity.

### Pitfall 4: Backup Failure Error Messages Not Specific Enough
**What goes wrong:** Generic "File error" message instead of "Backup failed: Permission denied on /path/to/file.txt.bak".
**Why it happens:** Current code uses `formatFileError(error, ...)` which produces generic messages.
**How to avoid:** Create backup-specific error formatting: `Backup failed: ${reason} on ${backupPath}`.
**Warning signs:** Error messages don't mention "backup" or the .bak path.

### Pitfall 5: Missing backup_path in Error Response
**What goes wrong:** When backup succeeds but edit fails, the response doesn't include backup_path, so the caller doesn't know the original is preserved.
**Why it happens:** Current ErrorResponse type doesn't include backup_path field; error path in applyEdits spreads result but may lose backup_path.
**How to avoid:** Ensure MultiEditResult always carries backup_path through error paths. Add backup_path to ErrorResponse type in reporter.ts.
**Warning signs:** Error JSON response lacks backup_path even though .bak file exists on disk.

### Pitfall 6: Default Value Change Breaking Existing Users
**What goes wrong:** Changing default from `false` to `true` means existing callers who don't pass `backup` parameter now get .bak files they didn't ask for.
**Why it happens:** This is intentional per user's decision ("backup on by default, opt-out").
**How to avoid:** This is the desired behavior. Document the change. Update tool schema description to say "(default: true)".
**Warning signs:** Not a pitfall per se, but worth noting for the planner.

## Code Examples

### Pattern 1: Backup Creation with Permission Preservation

```typescript
// Source: Node.js fs/promises documentation
import * as fs from 'fs/promises';

async function createBackup(
  filePath: string,
  content: string
): Promise<{ backupPath: string }> {
  const backupPath = `${filePath}.bak`;

  // Get original file permissions
  const stats = await fs.stat(filePath);

  // Write original content to backup
  await fs.writeFile(backupPath, content, 'utf8');

  // Preserve original file permissions
  await fs.chmod(backupPath, stats.mode & 0o7777);

  return { backupPath };
}
```

### Pattern 2: Backup-Specific Error Formatting

```typescript
function formatBackupError(error: unknown, backupPath: string): string {
  if (error instanceof Error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
      return `Backup failed: Permission denied on ${backupPath}`;
    }
    if (nodeError.code === 'ENOSPC') {
      return `Backup failed: No space left on device for ${backupPath}`;
    }
    if (nodeError.code === 'EROFS') {
      return `Backup failed: Read-only file system for ${backupPath}`;
    }
    return `Backup failed: ${error.message} on ${backupPath}`;
  }
  return `Backup failed: Unknown error on ${backupPath}`;
}
```

### Pattern 3: Refactored applyEdits Flow

```typescript
export async function applyEdits(
  filePath: string,
  edits: EditOperation[],
  dryRun: boolean = false,
  backup: boolean = true  // Changed: default true, renamed from createBackup
): Promise<MultiEditResult> {
  // 1. Read file content
  let content: string;
  try {
    content = await readFileValidated(filePath);
  } catch (error) {
    return { success: false, file_path: filePath, edits_applied: 0, results: [], error: formatFileError(error, filePath), dry_run: dryRun };
  }

  // 2. Create backup BEFORE any edits (if requested)
  let backupPath: string | undefined;
  if (backup) {
    try {
      const result = await createBackup(filePath, content);
      backupPath = result.backupPath;
    } catch (error) {
      return { success: false, file_path: filePath, edits_applied: 0, results: [], error: formatBackupError(error, `${filePath}.bak`), dry_run: dryRun };
    }
  }

  // 3. Apply edits in memory
  const result = applyEditsToContent(filePath, content, edits, dryRun);

  // 4. Attach backup_path to result (success OR failure)
  if (backupPath) {
    result.backup_path = backupPath;
  }

  // 5. If edits failed or dry run, return (backup already created, path attached)
  if (!result.success || dryRun) {
    return result;
  }

  // 6. Write result atomically
  try {
    await atomicWrite(filePath, result.final_content!);
  } catch (error) {
    return { ...result, success: false, error: formatFileError(error, filePath) };
  }

  return result;
}
```

### Pattern 4: Error Categorization Codes for Backup

```typescript
// Backup-specific error codes (Claude's discretion)
const BACKUP_ERROR_CODES = {
  BACKUP_PERMISSION_DENIED: 'EACCES/EPERM writing to backup path',
  BACKUP_NO_SPACE: 'ENOSPC - disk full',
  BACKUP_READ_ONLY_FS: 'EROFS - read-only filesystem',
  BACKUP_STAT_FAILED: 'Could not read source file permissions',
  BACKUP_CHMOD_FAILED: 'Could not set backup file permissions',
  BACKUP_UNKNOWN: 'Unexpected backup error',
} as const;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fs.copyFile` for backup | `fs.writeFile` when content in memory | Always | Avoids unnecessary disk re-read |
| Manual permission octal | `(stat.mode & 0o7777)` | N/A (stable API) | Standard Node.js pattern |
| `create_backup: false` default | `backup: true` default | This phase | Breaking change for callers not passing the param |

**No deprecated APIs involved:** All `fs/promises` APIs used are stable and current in Node.js 20+.

## Existing Code Gap Analysis

### What Already Works
- `MultiEditResult.backup_path` type field exists
- `SuccessResponse.backup_path` field in reporter exists
- `create_backup` Zod schema field exists
- Basic backup write in `applyEdits()` exists (lines 317-329)
- Tool schema for `create_backup` exists in index.ts

### What Must Change

| File | Change | Reason |
|------|--------|--------|
| `src/types/index.ts` | Rename `create_backup` to `backup` on MultiEditInput and MultiEditFilesInput | User said "opt-out with `backup: false`" |
| `src/core/validator.ts` | Rename field, change default from `false` to `true` | Backup on by default |
| `src/core/editor.ts` | Restructure applyEdits: backup before edits, add permission preservation, backup-specific errors, support dry-run+backup | Core implementation |
| `src/core/reporter.ts` | Add `backup_path` to ErrorResponse type | User requires backup_path in error responses |
| `src/tools/multi-edit.ts` | Update `input.create_backup` -> `input.backup` | Parameter rename |
| `src/tools/multi-edit-files.ts` | Update `input.create_backup` -> `input.backup` | Parameter rename |
| `src/index.ts` | Update tool schema: rename property, change default description, change default to true | Public API change |

### Test Coverage Needed

| Test Case | Type | Priority |
|-----------|------|----------|
| Backup created with original content | Unit (file I/O) | HIGH |
| Backup permissions match original | Unit (file I/O) | HIGH |
| Backup path returned in success response | Unit | HIGH |
| Backup path returned in error response (edit failure) | Unit | HIGH |
| Dry-run creates backup | Unit (file I/O) | HIGH |
| Backup failure aborts operation | Unit (file I/O) | HIGH |
| Backup failure error message includes reason | Unit | HIGH |
| Default behavior creates backup (no param) | Unit | HIGH |
| `backup: false` skips backup | Unit | HIGH |
| Double extension: file.bak -> file.bak.bak | Unit | MEDIUM |
| Existing .bak overwritten with fresh content | Unit (file I/O) | MEDIUM |
| Permission denied on backup path | Unit (file I/O) | MEDIUM |
| multi_edit_files creates per-file backups | Integration | MEDIUM |

## Open Questions

1. **Parameter name: `backup` vs keeping `create_backup`?**
   - What we know: User said "opt-out with `backup: false`" suggesting the name `backup`
   - What's unclear: Whether renaming is worth the churn vs just changing the default
   - Recommendation: Rename to `backup` -- it's cleaner, matches the user's language, and the codebase is small enough that the rename is trivial (6 files)

2. **Should `fs.stat` failure be a backup failure?**
   - What we know: If we can't read permissions, we can still write the backup with default permissions
   - What's unclear: Whether partial backup (correct content, wrong permissions) is acceptable
   - Recommendation: Treat stat failure as backup failure. The user explicitly said "Preserve original file permissions on the backup file." If we can't preserve them, the backup doesn't meet spec.

3. **Temp-file-then-rename for backup atomicity?**
   - What we know: The existing `atomicWrite` uses this pattern for the main file edit
   - What's unclear: Whether backup files warrant the same protection
   - Recommendation: Use direct `fs.writeFile` for backups. Rationale: (a) backups are advisory safety nets, not critical data; (b) if the process crashes mid-write, the original file is still intact; (c) avoids doubling the temp-file complexity. The user left this to Claude's discretion.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All source files in `src/` read directly
- [Node.js fs documentation](https://nodejs.org/api/fs.html) - `copyFile`, `stat`, `chmod`, `writeFile` APIs verified
- CONTEXT.md decisions: All locked choices verified against current code

### Secondary (MEDIUM confidence)
- [Node.js fs.copyFile permission issues](https://github.com/nodejs/node/issues/26936) - Confirmed copyFile does NOT preserve permissions
- [Node.js fs.copyFile EPERM issue](https://github.com/nodejs/node/issues/37284) - Read-only source considerations

### Tertiary (LOW confidence)
- None. All findings verified with primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Pure Node.js fs/promises, no new dependencies, all APIs verified in official docs
- Architecture: HIGH - Existing codebase thoroughly analyzed, gap analysis is precise
- Pitfalls: HIGH - All pitfalls identified from direct code reading of the existing scaffold
- Code examples: HIGH - Based on existing codebase patterns and verified Node.js APIs

**Research date:** 2026-02-06
**Valid until:** Indefinite (stable Node.js APIs, no version-sensitive findings)
