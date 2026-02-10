# Usage Guide

## How It Works

When you ask Claude to edit files, it normally uses the built-in `Edit` tool which handles one find-and-replace per call. With `multi_edit`, Claude can batch multiple edits into a single call, reducing overhead and ensuring atomicity.

You don't need to explicitly ask for `multi_edit` -- Claude will use it automatically when it's available and the task involves multiple edits.

## Tool 1: `multi_edit`

Edit a single file with multiple find-and-replace operations in one atomic call.

### Basic Example

Replace multiple strings in one file:

```json
{
  "file_path": "/path/to/project/src/app.ts",
  "edits": [
    {
      "old_string": "const oldName = getValue()",
      "new_string": "const newName = getValue()"
    },
    {
      "old_string": "console.log('debug:',",
      "new_string": "logger.info('debug:',",
      "replace_all": true
    }
  ]
}
```

### Key Behaviors

- **Sequential application:** Edits are applied in order. Edit 2 sees the result of edit 1.
- **Atomic:** If any edit fails, the entire operation is rolled back. The file stays unchanged.
- **Exact match:** `old_string` must match the file content exactly (including whitespace and indentation).
- **Backup:** A `.bak` file is created before any changes. Disable with `"backup": false`.

### Dry Run

Preview changes without modifying the file:

```json
{
  "file_path": "/path/to/file.ts",
  "edits": [
    { "old_string": "foo", "new_string": "bar" }
  ],
  "dry_run": true
}
```

The response includes a `diff_preview` showing exactly what would change.

### Replace All

By default, `old_string` must match exactly once. To replace every occurrence:

```json
{
  "edits": [
    {
      "old_string": "console.log",
      "new_string": "logger.info",
      "replace_all": true
    }
  ]
}
```

## Tool 2: `multi_edit_files`

Edit multiple files in a single atomic call. If any file fails, all files are rolled back.

### Example

Rename an interface across three files:

```json
{
  "files": [
    {
      "file_path": "/project/src/types.ts",
      "edits": [
        { "old_string": "interface UserData {", "new_string": "interface UserProfile {" }
      ]
    },
    {
      "file_path": "/project/src/api.ts",
      "edits": [
        { "old_string": "UserData", "new_string": "UserProfile", "replace_all": true }
      ]
    },
    {
      "file_path": "/project/src/components/profile.tsx",
      "edits": [
        { "old_string": "UserData", "new_string": "UserProfile", "replace_all": true }
      ]
    }
  ]
}
```

### Rollback

If file 3 fails, files 1 and 2 are automatically restored from their `.bak` backups. No file is left in a partial state.

## When Claude Uses Each Tool

| Scenario | Tool Used |
|----------|-----------|
| Multiple edits in one file | `multi_edit` |
| Edits across multiple files | `multi_edit_files` |
| Single edit in one file | Built-in `Edit` (or `multi_edit`) |
| Preview before changing | `multi_edit` with `dry_run: true` |

## Tips

1. **Be specific with `old_string`:** Include enough surrounding context to ensure a unique match. A full line is usually enough.

2. **Use `replace_all` for repetitive patterns:** When replacing `console.log` with `logger.info` across a file, set `replace_all: true` rather than listing each occurrence.

3. **Use dry run for large changes:** Ask Claude to preview with dry run first, then apply if the diff looks correct.

4. **Whitespace matters:** `old_string` must match exactly, including indentation (spaces vs tabs) and line endings.

## Error Codes

| Code | Meaning | What To Do |
|------|---------|------------|
| `MATCH_NOT_FOUND` | `old_string` not in file | Check whitespace, re-read the file |
| `AMBIGUOUS_MATCH` | `old_string` matches multiple places | Add more context or use `replace_all` |
| `VALIDATION_FAILED` | Invalid input | Check file path exists, edits array not empty |
| `FILE_NOT_FOUND` | File doesn't exist | Verify the absolute path |
| `PERMISSION_DENIED` | Can't read/write file | Check file permissions |
