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
claude mcp add --transport stdio "Multi Edit from Essential AI Solutions (essentialai.uk)" -- npx -y @essentialai/mcp-multi-edit
```

This adds the server to your user-level Claude Code configuration (`~/.claude.json`). It persists across sessions and is available in all projects.

> **Note:** The CLI adds the server as a "Local MCP" (user-level), not a "Project MCP". It will appear under "Local MCPs" in `/mcp`. To make it project-level, use Option A instead.

### Option C: Global install

If you prefer not to use `npx` on every invocation:

```bash
npm install -g @essentialai/mcp-multi-edit
```

Then configure `.mcp.json`:

```json
{
  "mcpServers": {
    "Multi Edit from Essential AI Solutions (essentialai.uk)": {
      "command": "mcp-multi-edit"
    }
  }
}
```

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
claude mcp remove "Multi Edit from Essential AI Solutions (essentialai.uk)"
```

### Global install

```bash
npm uninstall -g @essentialai/mcp-multi-edit
```
