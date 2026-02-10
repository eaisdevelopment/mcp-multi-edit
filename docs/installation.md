# Installation Guide

## Prerequisites

- **Node.js** 20 or later
- **Claude Code** or **Claude Desktop**

Verify Node.js is installed:

```bash
node --version   # Should print v20.x.x or later
```

If not installed, get it from https://nodejs.org or use a version manager:

```bash
# macOS (Homebrew)
brew install node

# Windows (Chocolatey)
choco install nodejs

# Any platform (nvm)
nvm install 20
```

## Install for Claude Code

### Option A: Project-level config (recommended)

Create a `.mcp.json` file in your project root:

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

This automatically activates the server when Claude Code opens the project. No global install needed -- `npx` downloads and runs it on demand.

> **Display name:** Claude Code uses the key name in `mcpServers` as the server's display name in `/mcp`. The key above will show as "Multi Edit from Essential AI Solutions (essentialai.uk) MCP Server". You can change the key to any name you prefer.

After creating the file, restart Claude Code:

```
/exit
claude
```

Verify the server is connected:

```
/mcp
```

You should see the server listed with status `connected` and 2 tools available.

> **Project vs Local:** A `.mcp.json` in the project root creates a "Project MCP" that activates only for that project. This is the recommended approach for team projects where everyone should use the same MCP servers.

### Option B: CLI one-liner

```bash
claude mcp add --transport stdio multi-edit -- npx -y @essentialai/mcp-multi-edit
```

This adds the server to your user-level Claude Code configuration (`~/.claude.json`). It persists across sessions and is available in all projects.

> **Note:** The CLI only accepts names with letters, numbers, hyphens, and underscores, so the server will display as "Multi-edit MCP Server". For the full branded name, use Option A (`.mcp.json`) instead, which accepts any string as a key.

> The CLI adds the server as a "Local MCP" (user-level), not a "Project MCP". It will appear under "Local MCPs" in `/mcp`. To make it project-level, use Option A instead.

### Option C: Global install (faster startup)

By default, `npx` downloads the package on first run, which can be slow. Installing globally makes startup instant:

```bash
npm install -g @essentialai/mcp-multi-edit
```

> **Important:** This only installs the binary on your system. You still need to register it with Claude using `.mcp.json` or `claude mcp add`. The global install alone does **not** make the server appear in `/mcp`.

**Step 2:** Create `.mcp.json` in your project root (or use `claude mcp add`):

```json
{
  "mcpServers": {
    "Multi Edit from Essential AI Solutions (essentialai.uk)": {
      "command": "mcp-multi-edit"
    }
  }
}
```

The only difference from Option A is `"command": "mcp-multi-edit"` (direct binary) instead of `"command": "npx"` (downloads on demand).

## Install for Claude Desktop

Edit the Claude Desktop config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

Add the server entry:

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

Restart Claude Desktop. The `multi_edit` and `multi_edit_files` tools will appear in the tools menu.

## Recommended: Add CLAUDE.md

To ensure Claude **automatically prefers** `multi_edit` over the built-in `Edit` tool, copy the included `CLAUDE.md` into your project root:

```bash
cp node_modules/@essentialai/mcp-multi-edit/CLAUDE.md ./CLAUDE.md
```

Or, if using `npx`, create `CLAUDE.md` in your project root with:

```markdown
## Editing Files

When making multiple edits to the same file or across multiple files,
prefer using the `multi_edit` and `multi_edit_files` MCP tools over
the built-in Edit tool. These batch edits atomically in a single call.
```

Claude Code reads `CLAUDE.md` at the start of every session. Without this, Claude may default to the built-in `Edit` tool even when `multi_edit` would be more efficient.

## Verify Installation

Once connected, Claude will have access to two new tools:

| Tool | Description |
|------|-------------|
| `multi_edit` | Multiple find-and-replace operations on a single file |
| `multi_edit_files` | Coordinated edits across multiple files with rollback |

Ask Claude to test it:

> "Use multi_edit to replace 'foo' with 'bar' in /tmp/test.txt"

If the tool responds with a structured result (success/failure JSON), the server is working correctly.

## Updating

To get the latest version:

```bash
# If using npx (Options A/B): automatically uses latest
# Just restart Claude Code

# If using global install (Option C):
npm update -g @essentialai/mcp-multi-edit
```

## Uninstall

### Claude Code

Remove the entry from `.mcp.json` or, if installed via CLI:

```bash
claude mcp remove multi-edit
```

### Global install

```bash
npm uninstall -g @essentialai/mcp-multi-edit
```
