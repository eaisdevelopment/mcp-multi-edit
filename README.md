# @essentialai/mcp-multi-edit

[![npm version](https://img.shields.io/npm/v/@essentialai/mcp-multi-edit)](https://www.npmjs.com/package/@essentialai/mcp-multi-edit) [![license](https://img.shields.io/npm/l/@essentialai/mcp-multi-edit)](./LICENSE) [![build](https://img.shields.io/github/actions/workflow/status/eaisdevelopment/mcp-multi-edit/ci.yml?branch=main)](https://github.com/eaisdevelopment/mcp-multi-edit/actions) [![coverage](https://img.shields.io/badge/coverage-90%25%2B-brightgreen)](./README.md)

MCP server providing atomic multi-edit capabilities for Claude Code and Claude Desktop. Perform multiple find-and-replace operations in a single tool call with guaranteed atomicity -- all edits succeed or none apply.

## Quick Start (Claude Code)

### Using .mcp.json (recommended)

Add a `.mcp.json` file to your project root:

```json
{
  "mcpServers": {
    "multi-edit": {
      "command": "npx",
      "args": ["-y", "@essentialai/mcp-multi-edit"]
    }
  }
}
```

The tools will be available as `mcp__multi-edit__multi_edit` and `mcp__multi-edit__multi_edit_files`.

### Using CLI

```bash
claude mcp add --transport stdio multi-edit -- npx -y @essentialai/mcp-multi-edit
```

## Quick Start (Claude Desktop)

Add the server to your Claude Desktop configuration file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "multi-edit": {
      "command": "npx",
      "args": ["-y", "@essentialai/mcp-multi-edit"]
    }
  }
}
```

## Features

- **Atomic operations** -- all edits in a tool call succeed or none apply
- **Dry-run preview** -- see exactly what would change before committing
- **Automatic backups** -- `.bak` files created before every edit (opt-out with `backup: false`)
- **Multi-file coordination** -- edit across multiple files with automatic rollback on failure
- **Structured error responses** -- machine-readable error codes with recovery hints for retry logic
- **Conflict detection** -- warns when the same string matches multiple locations
- **Path validation** -- absolute path enforcement, symlink resolution, existence checks

## Tools

### `multi_edit`

Perform multiple find-and-replace operations on a single file atomically. Edits are applied sequentially -- the output of one edit becomes the input for the next.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `file_path` | string | Yes | -- | Absolute path to the file to modify |
| `edits` | array | Yes | -- | Array of edit operations (applied sequentially) |
| `edits[].old_string` | string | Yes | -- | Text to find in the file |
| `edits[].new_string` | string | Yes | -- | Replacement text |
| `edits[].replace_all` | boolean | No | `false` | Replace all occurrences instead of requiring exactly one match |
| `dry_run` | boolean | No | `false` | Preview changes without applying them |
| `backup` | boolean | No | `true` | Create a `.bak` backup file before editing |
| `include_content` | boolean | No | `false` | Include the final file content in the response |

#### Example: Basic usage

Rename a variable and update a function name in one call:

```json
{
  "file_path": "/home/user/project/src/app.ts",
  "edits": [
    {
      "old_string": "const oldConfig = loadConfig()",
      "new_string": "const appConfig = loadConfig()"
    },
    {
      "old_string": "function processData(",
      "new_string": "function transformData("
    }
  ]
}
```

Response:

```json
{
  "success": true,
  "file_path": "/home/user/project/src/app.ts",
  "edits_applied": 2,
  "dry_run": false,
  "edits": [
    { "old_string": "const oldConfig = loadConfig()", "matched": true, "occurrences_replaced": 1 },
    { "old_string": "function processData(", "matched": true, "occurrences_replaced": 1 }
  ],
  "backup_path": "/home/user/project/src/app.ts.bak"
}
```

#### Example: Dry-run preview

Preview what would change without modifying the file:

```json
{
  "file_path": "/home/user/project/src/utils.ts",
  "edits": [
    {
      "old_string": "export function formatDate(",
      "new_string": "export function formatTimestamp("
    }
  ],
  "dry_run": true
}
```

Response:

```json
{
  "success": true,
  "file_path": "/home/user/project/src/utils.ts",
  "edits_applied": 1,
  "dry_run": true,
  "message": "DRY RUN - No changes made to file",
  "diff_preview": "--- /home/user/project/src/utils.ts (original)\n+++ /home/user/project/src/utils.ts (modified)\nL5: - export function formatDate(\nL5: + export function formatTimestamp(",
  "edits": [
    { "old_string": "export function formatDate(", "matched": true, "occurrences_replaced": 1 }
  ],
  "backup_path": "/home/user/project/src/utils.ts.bak"
}
```

#### Example: Replace all occurrences

Replace every occurrence of a string throughout the file:

```json
{
  "file_path": "/home/user/project/src/logger.ts",
  "edits": [
    {
      "old_string": "console.log",
      "new_string": "logger.info",
      "replace_all": true
    }
  ]
}
```

Response:

```json
{
  "success": true,
  "file_path": "/home/user/project/src/logger.ts",
  "edits_applied": 1,
  "dry_run": false,
  "edits": [
    { "old_string": "console.log", "matched": true, "occurrences_replaced": 8 }
  ],
  "backup_path": "/home/user/project/src/logger.ts.bak"
}
```

#### Example: Error handling

When `old_string` is not found in the file, no changes are applied and a structured error is returned:

```json
{
  "file_path": "/home/user/project/src/app.ts",
  "edits": [
    {
      "old_string": "const result = calculate()",
      "new_string": "const result = compute()"
    }
  ]
}
```

Error response:

```json
{
  "success": false,
  "error_code": "MATCH_NOT_FOUND",
  "message": "Edit 1 of 1 failed: 'const result = calculate()' not found in file",
  "retryable": true,
  "file_path": "/home/user/project/src/app.ts",
  "edit_index": 0,
  "recovery_hints": [
    "Check for whitespace differences between old_string and file content",
    "Re-read the file to see its current content before retrying"
  ],
  "context": {
    "snippet": "import { loadConfig } from './config';\n\nconst appConfig = loadConfig();\n\nfunction transformData(input: string) {\n  return input.trim();\n}"
  },
  "edit_status": [
    {
      "edit_index": 0,
      "status": "failed",
      "error_code": "MATCH_NOT_FOUND",
      "message": "'const result = calculate()' not found in file",
      "old_string_preview": "const result = calculate()"
    }
  ],
  "backup_path": "/home/user/project/src/app.ts.bak"
}
```

### `multi_edit_files`

Perform coordinated edits across multiple files atomically. If any file edit fails, all changes are rolled back -- no file is left in a partial state.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `files` | array | Yes | -- | Array of file edit operations |
| `files[].file_path` | string | Yes | -- | Absolute path to the file |
| `files[].edits` | array | Yes | -- | Array of edits (same format as `multi_edit`) |
| `dry_run` | boolean | No | `false` | Preview changes without applying them |
| `include_content` | boolean | No | `false` | Include final file content in each file result |

#### Example: Rename across files

Rename a function across three files in one atomic operation:

```json
{
  "files": [
    {
      "file_path": "/home/user/project/src/types.ts",
      "edits": [
        { "old_string": "export interface UserData {", "new_string": "export interface UserProfile {" }
      ]
    },
    {
      "file_path": "/home/user/project/src/api.ts",
      "edits": [
        { "old_string": "function fetchUserData(", "new_string": "function fetchUserProfile(" },
        { "old_string": "): Promise<UserData>", "new_string": "): Promise<UserProfile>" }
      ]
    },
    {
      "file_path": "/home/user/project/src/components/profile.tsx",
      "edits": [
        { "old_string": "const data: UserData =", "new_string": "const data: UserProfile =" }
      ]
    }
  ]
}
```

Response:

```json
{
  "success": true,
  "files_edited": 3,
  "file_results": [
    {
      "success": true,
      "file_path": "/home/user/project/src/types.ts",
      "edits_applied": 1,
      "dry_run": false,
      "results": [
        { "old_string": "export interface UserData {", "matches": 1, "replaced": 1, "success": true }
      ],
      "backup_path": "/home/user/project/src/types.ts.bak"
    },
    {
      "success": true,
      "file_path": "/home/user/project/src/api.ts",
      "edits_applied": 2,
      "dry_run": false,
      "results": [
        { "old_string": "function fetchUserData(", "matches": 1, "replaced": 1, "success": true },
        { "old_string": "): Promise<UserData>", "matches": 1, "replaced": 1, "success": true }
      ],
      "backup_path": "/home/user/project/src/api.ts.bak"
    },
    {
      "success": true,
      "file_path": "/home/user/project/src/components/profile.tsx",
      "edits_applied": 1,
      "dry_run": false,
      "results": [
        { "old_string": "const data: UserData =", "matches": 1, "replaced": 1, "success": true }
      ],
      "backup_path": "/home/user/project/src/components/profile.tsx.bak"
    }
  ],
  "dry_run": false,
  "summary": {
    "total_files": 3,
    "files_succeeded": 3,
    "files_failed": 0,
    "total_edits": 4
  }
}
```

#### Example: Multi-file with rollback

If an edit fails in any file, all previously applied changes are rolled back automatically. Backups are always created for multi-file operations as the rollback mechanism.

```json
{
  "files": [
    {
      "file_path": "/home/user/project/src/config.ts",
      "edits": [
        { "old_string": "const PORT = 3000", "new_string": "const PORT = 8080" }
      ]
    },
    {
      "file_path": "/home/user/project/src/server.ts",
      "edits": [
        { "old_string": "this string does not exist in the file", "new_string": "replacement" }
      ]
    }
  ]
}
```

Error response (file 2 fails, file 1 is rolled back):

```json
{
  "success": false,
  "files_edited": 2,
  "file_results": [
    {
      "success": true,
      "file_path": "/home/user/project/src/config.ts",
      "edits_applied": 1,
      "dry_run": false,
      "results": [
        { "old_string": "const PORT = 3000", "matches": 1, "replaced": 1, "success": true }
      ],
      "backup_path": "/home/user/project/src/config.ts.bak"
    },
    {
      "success": false,
      "file_path": "/home/user/project/src/server.ts",
      "edits_applied": 0,
      "dry_run": false,
      "results": [
        { "old_string": "this string does not exist in the file", "matches": 0, "replaced": 0, "success": false, "error": "'this string does not exist in the fi...' not found in file" }
      ],
      "error": "'this string does not exist in the fi...' not found in file",
      "failed_edit_index": 0,
      "backup_path": "/home/user/project/src/server.ts.bak"
    }
  ],
  "error": "File 2 of 2 failed: /home/user/project/src/server.ts",
  "failed_file_index": 1,
  "dry_run": false,
  "rollback": {
    "files_rolled_back": 1,
    "files_failed_rollback": 0,
    "details": [
      { "file_path": "/home/user/project/src/config.ts", "status": "restored", "backup_path": "/home/user/project/src/config.ts.bak" }
    ]
  }
}
```

## Error Handling

All errors return a structured `ErrorEnvelope` with machine-readable codes and recovery guidance:

```json
{
  "success": false,
  "error_code": "MATCH_NOT_FOUND",
  "message": "Edit 1 of 2 failed: 'oldText' not found in file",
  "retryable": true,
  "file_path": "/home/user/project/src/app.ts",
  "edit_index": 0,
  "recovery_hints": [
    "Check for whitespace differences between old_string and file content",
    "Re-read the file to see its current content before retrying"
  ]
}
```

### Error Codes

| Code | Retryable | Description |
|------|-----------|-------------|
| `MATCH_NOT_FOUND` | Yes | The `old_string` was not found in the file |
| `AMBIGUOUS_MATCH` | Yes | The `old_string` matches multiple locations (use `replace_all: true` or make it more specific) |
| `VALIDATION_FAILED` | Yes | Input does not match the expected schema |
| `FILE_NOT_FOUND` | No | The specified file does not exist |
| `PERMISSION_DENIED` | No | Insufficient permissions to read or write the file |
| `BACKUP_FAILED` | No | Could not create the backup file |

When `retryable` is `true`, Claude can read the `recovery_hints`, adjust the input, and retry the operation.

## Development

```bash
npm install           # Install dependencies
npm run build         # Compile TypeScript
npm run test          # Run tests
npm run test:coverage # Run tests with coverage report
npm run dev           # Development mode with watch
```

### Project Structure

```
src/
  index.ts              # MCP server entry point (stdio transport)
  server.ts             # Server factory (tool registration)
  tools/
    multi-edit.ts       # multi_edit tool handler
    multi-edit-files.ts # multi_edit_files tool handler
  core/
    editor.ts           # File editing engine (atomic read-modify-write)
    validator.ts        # Zod input validation schemas
    reporter.ts         # Result formatting and diff generation
    errors.ts           # Error classification and envelope creation
  types/
    index.ts            # TypeScript type definitions
```

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](./LICENSE).

Free for personal use. For commercial licensing inquiries, contact support@essentialai.uk.
