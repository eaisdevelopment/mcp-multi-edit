# Installation Guide

## Prerequisites

- **Node.js 20+** -- verify with `node --version`
- **Claude Code** or **Claude Desktop**

## Step 1: Create `.mcp.json`

Create a file called `.mcp.json` in your **project root** (the folder where you run `claude`):

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

Nothing else to install. `npx` downloads the package automatically on first use.

## Step 2: Restart Claude Code

```
/exit
claude
```

## Step 3: Verify

Run `/mcp` in Claude Code. You should see:

```
Multi Edit from Essential AI Solutions (essentialai.uk) · connected
```

With **2 tools** available: `multi_edit` and `multi_edit_files`.

If the server shows `error` status, select it and choose "Reconnect". See [Troubleshooting](./troubleshooting.md) if problems persist.

## Step 4: Add CLAUDE.md (recommended)

Create a `CLAUDE.md` file in your project root with this content:

```markdown
## Editing Files

When making multiple edits to the same file or across multiple files,
prefer using the `multi_edit` and `multi_edit_files` MCP tools over
the built-in Edit tool. These batch edits atomically in a single call.
```

This tells Claude to **automatically prefer** `multi_edit` over the built-in Edit tool. Without it, Claude may default to single edits even when batching would be faster.

## Done

That's it. Four steps:

1. Create `.mcp.json`
2. Restart Claude Code
3. Verify with `/mcp`
4. Add `CLAUDE.md`

---

## Claude Desktop

Same steps, but the config file location is different:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

Add the same `mcpServers` block to that file and restart Claude Desktop.

## Alternative: CLI one-liner

If you prefer not to create `.mcp.json` manually:

```bash
claude mcp add --transport stdio multi-edit -- npx -y @essentialai/mcp-multi-edit
```

This registers the server in your user-level config (`~/.claude.json`). It works across all projects but the display name will be "Multi-edit MCP Server" (the CLI only accepts simple names -- no spaces or parentheses).

## Alternative: Global install (faster startup)

`npx` downloads the package on first run. To skip that delay:

```bash
npm install -g @essentialai/mcp-multi-edit
```

Then use `"command": "mcp-multi-edit"` in your `.mcp.json` instead of `"command": "npx"`:

```json
{
  "mcpServers": {
    "Multi Edit from Essential AI Solutions (essentialai.uk)": {
      "command": "mcp-multi-edit"
    }
  }
}
```

**You still need `.mcp.json`.** The global install only puts the binary on your system -- it does not register the server with Claude.

## Updating

```bash
# Using npx: automatically uses latest. Just restart Claude Code.
# Using global install: run npm update -g @essentialai/mcp-multi-edit
```

## Uninstall

Delete the `mcpServers` entry from `.mcp.json`. Or if installed via CLI:

```bash
claude mcp remove multi-edit
```
