# Installation Guide

## Prerequisites

- **Node.js 20+** -- verify with `node --version`
- **Claude Code** or **Claude Desktop**

## Install

```bash
claude mcp add --transport stdio multi-edit -- npx -y @essentialai/mcp-multi-edit
```

Restart Claude Code:

```
/exit
claude
```

Run `/mcp` to verify -- you should see `multi-edit` with status `connected` and 2 tools.

## Make Claude prefer multi_edit (recommended)

Add this to your project's `CLAUDE.md` (create the file if it doesn't exist):

```markdown
## Editing Files

When making multiple edits to the same file or across multiple files,
prefer using the `multi_edit` and `multi_edit_files` MCP tools over
the built-in Edit tool. These batch edits atomically in a single call.
```

Without this, Claude may default to the built-in Edit tool even when batching would be faster.

---

## Alternative: Project-level config

If you want the server tied to a specific project (so teammates get it too), create `.mcp.json` in the project root instead:

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

Restart Claude Code. This shows up under "Project MCPs" in `/mcp` and only activates for that project.

> The key name in `mcpServers` becomes the display name. The CLI method above uses `multi-edit` (CLI only accepts simple names).

## Claude Desktop

Edit the config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

Add:

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

## Updating

Using `npx`: automatically uses latest version. Just restart Claude Code.

## Uninstall

```bash
claude mcp remove multi-edit
```
