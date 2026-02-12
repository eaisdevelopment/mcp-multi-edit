# Multi Edit MCP Server

[![npm version](https://img.shields.io/npm/v/@essentialai/mcp-multi-edit)](https://www.npmjs.com/package/@essentialai/mcp-multi-edit)
[![license](https://img.shields.io/npm/l/@essentialai/mcp-multi-edit)](./LICENSE)
[![tests](https://img.shields.io/badge/tests-264%20passed-brightgreen)](./tests)
[![coverage](https://img.shields.io/badge/coverage-90%25%2B-brightgreen)](./tests)

An [MCP](https://modelcontextprotocol.io) server that gives Claude the ability to perform **multiple find-and-replace operations in a single tool call** with guaranteed atomicity -- all edits succeed or none apply.

Built by [Essential AI Solutions](https://essentialai.uk) for Claude Code and Claude Desktop.

## Why Multi Edit?

Claude's built-in `Edit` tool handles **one** find-and-replace per call. When renaming a variable across a file or refactoring multiple files, that means dozens of individual tool calls -- each consuming context tokens and adding latency.

**Multi Edit batches them into a single call:**

```
Without multi_edit:      105 tool calls   |   15,750 tokens
With multi_edit:          21 tool calls   |    7,850 tokens   (-80% calls, -50% tokens)
With multi_edit_files:     6 tool calls   |    4,550 tokens   (-94% calls, -71% tokens)
```

> Benchmarks run on realistic scenarios (bulk rename, logging migration, cross-file refactor).
> See [benchmarks/results/BENCHMARK-REPORT.md](./benchmarks/results/BENCHMARK-REPORT.md) for full details.

## Quick Start

### Claude Code

Add `.mcp.json` to your project root:

```json
{
  "mcpServers": {
    "Multi Edit from Essential AI Solutions (essentialai.uk)": {
      "command": "npx",
      "args": ["-y", "@essentialai/mcp-multi-edit"]
    }
  }
}
```

Restart Claude Code. Then add the included `CLAUDE.md` to your project root so Claude **automatically prefers** `multi_edit` over the built-in Edit tool:

```markdown
## Editing Files

When making multiple edits to the same file or across multiple files,
prefer using the `multi_edit` and `multi_edit_files` MCP tools over
the built-in Edit tool. These batch edits atomically in a single call.
```

That's it -- Claude will now use `multi_edit` whenever it's the right tool for the job.

> **Display name:** Claude Code uses the key name in `mcpServers` as the server's display name. You can change the key to any name you prefer.

**Alternative:** One-liner via CLI:

```bash
claude mcp add --transport stdio multi-edit -- npx -y @essentialai/mcp-multi-edit
```

> **Note:** The CLI only accepts simple names (letters, numbers, hyphens, underscores). For the full branded display name, use the `.mcp.json` approach above.

### Claude Desktop

Add to your config file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "Multi Edit from Essential AI Solutions (essentialai.uk)": {
      "command": "npx",
      "args": ["-y", "@essentialai/mcp-multi-edit"]
    }
  }
}
```

Restart Claude Desktop.

> **Full installation guide:** [docs/installation.md](./docs/installation.md)

## Tools

### `multi_edit` -- Single file, multiple edits

Batch multiple find-and-replace operations on one file. Edits apply sequentially and atomically.

```json
{
  "file_path": "/project/src/app.ts",
  "edits": [
    { "old_string": "const oldName = getValue()", "new_string": "const newName = getValue()" },
    { "old_string": "console.log", "new_string": "logger.info", "replace_all": true }
  ]
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `file_path` | string | required | Absolute path to the file |
| `edits` | array | required | Find-and-replace operations (applied in order) |
| `edits[].old_string` | string | required | Text to find (exact match) |
| `edits[].new_string` | string | required | Replacement text |
| `edits[].replace_all` | boolean | `false` | Replace all occurrences |
| `dry_run` | boolean | `false` | Preview changes without applying |
| `backup` | boolean | `true` | Create `.bak` backup before editing |

### `multi_edit_files` -- Multiple files, one atomic operation

Coordinate edits across multiple files. If any file fails, **all files are rolled back** automatically.

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
    }
  ]
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `files` | array | required | Array of file edit operations |
| `files[].file_path` | string | required | Absolute path to the file |
| `files[].edits` | array | required | Edits for this file (same format as above) |
| `dry_run` | boolean | `false` | Preview changes without applying |

> **Full usage guide with examples:** [docs/usage.md](./docs/usage.md)

## Features

- **Atomic operations** -- all edits succeed or none apply, no partial state
- **Multi-file rollback** -- if any file fails, all previously changed files are restored
- **Dry-run preview** -- see exactly what would change before committing
- **Automatic backups** -- `.bak` files created before every edit (disable with `backup: false`)
- **Structured errors** -- machine-readable error codes with recovery hints for automatic retry
- **Conflict detection** -- warns when `old_string` matches multiple locations
- **Path validation** -- absolute path enforcement, symlink resolution, existence checks

## Error Codes

| Code | Retryable | Description |
|------|-----------|-------------|
| `MATCH_NOT_FOUND` | Yes | `old_string` not found in file |
| `AMBIGUOUS_MATCH` | Yes | `old_string` matches multiple locations |
| `VALIDATION_FAILED` | Yes | Invalid input schema |
| `FILE_NOT_FOUND` | No | File does not exist |
| `PERMISSION_DENIED` | No | Insufficient file permissions |
| `BACKUP_FAILED` | No | Could not create backup file |

When `retryable` is `true`, Claude reads the `recovery_hints` in the response, adjusts the input, and retries automatically.

> **Troubleshooting guide:** [docs/troubleshooting.md](./docs/troubleshooting.md)

## Requirements

- **Node.js** 20 or later
- **Claude Code** or **Claude Desktop**

## Development

```bash
npm install           # Install dependencies
npm run build         # Compile TypeScript
npm test              # Run 264 tests
npm run test:coverage # Coverage report (90%+)
npm run benchmark     # Run benchmark suite
npm run dev           # Watch mode
```

### Project Structure

```
src/
  index.ts              # MCP server entry (stdio transport)
  server.ts             # Server factory and tool registration
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

## Documentation

| Document | Description |
|----------|-------------|
| [Installation Guide](./docs/installation.md) | All setup options for Claude Code and Claude Desktop |
| [Usage Guide](./docs/usage.md) | Detailed tool reference with examples |
| [Troubleshooting](./docs/troubleshooting.md) | Common issues and solutions |
| [Changelog](./CHANGELOG.md) | Version history |
| [Benchmark Report](./benchmarks/results/BENCHMARK-REPORT.md) | Performance measurements |

## License

[PolyForm Noncommercial License 1.0.0](./LICENSE)

Free for personal and non-commercial use. For commercial licensing, contact [support@essentialai.uk](mailto:support@essentialai.uk).

---

Built by [Essential AI Solutions](https://essentialai.uk)
