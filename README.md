# @anthropic-community/eais-mcp-multi-edit

MCP server providing atomic multi-edit capabilities for Claude Code and Claude Desktop.

## Features

- **multi_edit**: Multiple find-and-replace operations in a single file
- **multi_edit_files**: Coordinated edits across multiple files
- **Atomic**: All edits succeed or none apply
- **Dry-run**: Preview changes before applying
- **Backup**: Optional .bak file creation

## Installation

```bash
npm install -g @anthropic-community/eais-mcp-multi-edit
```

## Usage with Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "multi-edit": {
      "command": "npx",
      "args": ["-y", "@anthropic-community/eais-mcp-multi-edit"]
    }
  }
}
```

## Usage with Claude Code

The server will be automatically available as `mcp__eais-multi-edit__multi_edit` and `mcp__eais-multi-edit__multi_edit_files`.

## Tool: multi_edit

Perform multiple find-and-replace operations on a single file atomically.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file_path | string | Yes | Absolute path to the file |
| edits | array | Yes | Array of edit operations |
| edits[].old_string | string | Yes | Text to find |
| edits[].new_string | string | Yes | Replacement text |
| edits[].replace_all | boolean | No | Replace all occurrences (default: false) |
| dry_run | boolean | No | Preview changes without applying (default: false) |

### Example

```json
{
  "file_path": "/path/to/file.ts",
  "edits": [
    { "old_string": "const foo = 1", "new_string": "const bar = 1" },
    { "old_string": "function oldName", "new_string": "function newName" },
    { "old_string": "TODO", "new_string": "DONE", "replace_all": true }
  ],
  "dry_run": false
}
```

### Response

```json
{
  "success": true,
  "file_path": "/path/to/file.ts",
  "edits_applied": 3,
  "results": [
    { "old_string": "const foo = 1", "matches": 1, "replaced": 1 },
    { "old_string": "function oldName", "matches": 1, "replaced": 1 },
    { "old_string": "TODO", "matches": 5, "replaced": 5 }
  ]
}
```

## Tool: multi_edit_files

Perform coordinated edits across multiple files atomically.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| files | array | Yes | Array of file edit operations |
| files[].file_path | string | Yes | Absolute path to file |
| files[].edits | array | Yes | Array of edits (same as multi_edit) |
| dry_run | boolean | No | Preview changes without applying |

### Example

```json
{
  "files": [
    {
      "file_path": "/path/to/file1.ts",
      "edits": [{ "old_string": "oldVar", "new_string": "newVar", "replace_all": true }]
    },
    {
      "file_path": "/path/to/file2.ts",
      "edits": [{ "old_string": "oldVar", "new_string": "newVar", "replace_all": true }]
    }
  ],
  "dry_run": false
}
```

## Error Handling

If any edit fails, **no changes are applied** (atomic behavior). The response will include:

```json
{
  "success": false,
  "error": "Edit failed: 'nonexistent string' not found in file",
  "file_path": "/path/to/file.ts",
  "failed_edit_index": 2
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm run test

# Development mode
npm run dev
```

## License

MIT

## Contributing

Contributions are welcome! Please ensure:
- Tests pass (`npm run test`)
- Code coverage > 90%
- Follow existing code style
