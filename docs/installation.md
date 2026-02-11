# Installation Guide

## Prerequisites

- **Node.js 20+** -- verify with `node --version`
- **Claude Code** or **Claude Desktop**

## Install

```bash
claude plugin marketplace add eaisdevelopment/claude-plugins
claude plugin install multi-edit@eaisdevelopment-claude-plugins
```

Restart Claude Code (`/exit` then `claude`). Run `/mcp` to verify -- you should see the server with status `connected` and 2 tools.

Done. The plugin automatically configures the MCP server and tells Claude to prefer `multi_edit` over the built-in Edit tool.

---

## Alternative: Manual MCP setup

If you prefer not to use the plugin system:

```bash
claude mcp add --transport stdio multi-edit -- npx -y @essentialai/mcp-multi-edit
```

Restart Claude Code. This registers the MCP server directly without the plugin wrapper.

## Alternative: Project-level config

To share the server with teammates via version control, create `.mcp.json` in the project root:

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

Restart Claude Code. This shows up under "Project MCPs" in `/mcp`.

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

Plugin: `claude plugin marketplace update eaisdevelopment-claude-plugins`

Manual: Just restart Claude Code (npx fetches latest automatically).

## Uninstall

Plugin: `claude plugin uninstall multi-edit@eaisdevelopment-claude-plugins`

Manual: `claude mcp remove multi-edit`
