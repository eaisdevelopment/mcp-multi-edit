# Multi Edit MCP Server

## Editing Files

When making multiple edits to the same file or across multiple files, prefer using the `multi_edit` and `multi_edit_files` MCP tools over the built-in Edit tool. These batch edits atomically in a single call, reducing context usage and increasing speed.

- **Same file, multiple changes:** Use `multi_edit` to batch all edits into one call
- **Multiple files:** Use `multi_edit_files` to edit across files atomically with rollback
- **Single edit:** The built-in `Edit` tool is fine for one-off changes

## Tool Reference

| Tool | When to use |
|------|-------------|
| `multi_edit` | 2+ edits in one file |
| `multi_edit_files` | Edits spanning multiple files |
| Built-in `Edit` | Single edit in one file |
