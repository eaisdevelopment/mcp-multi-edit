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
    "multi-edit": {
      "command": "npx",
      "args": ["-y", "@essentialai/mcp-multi-edit"]
    }
  }
}
```

This automatically activates the server when Claude Code opens the project. No global install needed -- `npx` downloads and runs it on demand.

After creating the file, restart Claude Code:

```
/exit
claude
```

Verify the server is connected:

```
/mcp
```

You should see `multi-edit` listed with status `connected` and 2 tools available.

### Option B: CLI one-liner

```bash
claude mcp add --transport stdio multi-edit -- npx -y @essentialai/mcp-multi-edit
```

This adds the server to your Claude Code configuration. It persists across sessions.

### Option C: Global install

If you prefer not to use `npx` on every invocation:

```bash
npm install -g @essentialai/mcp-multi-edit
```

Then configure `.mcp.json`:

```json
{
  "mcpServers": {
    "multi-edit": {
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
    "multi-edit": {
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

Remove from `.mcp.json` or run:

```bash
claude mcp remove multi-edit
```

### Global install

```bash
npm uninstall -g @essentialai/mcp-multi-edit
```
