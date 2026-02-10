# Troubleshooting

## Server Not Connecting

### Symptom: `/mcp` shows no `multi-edit` server

**Check 1: `.mcp.json` is in the right place**

The file must be in the project root (same directory where you run `claude`):

```bash
ls -la .mcp.json
```

**Check 2: JSON is valid**

```bash
cat .mcp.json | python3 -m json.tool
```

Common mistakes:
- Trailing comma after last property
- Missing quotes around keys
- Wrong nesting level

**Check 3: Node.js is available**

```bash
node --version
npx --version
```

Both should return version numbers. If not, install Node.js 20+.

**Check 4: Package is accessible**

```bash
npx -y @essentialai/mcp-multi-edit --help
```

If this fails, check your network connection and npm registry access.

**Check 5: Restart Claude Code**

After creating or modifying `.mcp.json`, you must restart:

```
/exit
claude
```

### Symptom: Server shows `error` status in `/mcp`

Select the server in `/mcp` and choose "Reconnect". If it still fails, check the error message. Common causes:

- Node.js not in PATH
- npm registry unreachable (corporate firewall/proxy)
- Corrupted npm cache: `npm cache clean --force`

## Edit Failures

### "MATCH_NOT_FOUND"

The `old_string` doesn't match any text in the file. This is almost always a whitespace issue.

**Fix:** Ask Claude to re-read the file first, then retry:

> "Read the file again and try the edit"

Common causes:
- Tabs vs spaces mismatch
- Trailing whitespace
- File was modified between read and edit
- Line ending differences (CRLF vs LF)

### "AMBIGUOUS_MATCH"

The `old_string` matches more than one location in the file.

**Fix:** Either:
1. Make `old_string` more specific (include more surrounding context)
2. Add `"replace_all": true` if you want to replace all occurrences

### "FILE_NOT_FOUND"

**Fix:** Verify the path is absolute and the file exists:

```bash
ls -la /the/path/from/error
```

Relative paths are not supported. The path must start with `/` (macOS/Linux) or a drive letter (Windows).

### "PERMISSION_DENIED"

**Fix:** Check file permissions:

```bash
ls -la /the/file/path
```

The file must be readable and writable by the current user.

## Performance

### Server takes long to start

First invocation with `npx` downloads the package. Subsequent runs use the cached version. If startup is slow:

```bash
# Pre-install globally for instant startup
npm install -g @essentialai/mcp-multi-edit
```

Then use `"command": "mcp-multi-edit"` in your config instead of `npx`.

### Large files

The server reads entire files into memory. For very large files (>10MB), edits may be slow. Consider splitting large files or editing specific sections.

## Backup Files

### `.bak` files appearing everywhere

Every edit creates a backup. To disable:

```json
{
  "file_path": "/path/to/file",
  "edits": [...],
  "backup": false
}
```

To clean up existing backups:

```bash
find /your/project -name "*.bak" -delete
```

Add `*.bak` to your `.gitignore`:

```
*.bak
```

## Getting Help

- **GitHub Issues:** https://github.com/eaisdevelopment/mcp-multi-edit/issues
- **npm Package:** https://www.npmjs.com/package/@essentialai/mcp-multi-edit
- **Contact:** support@essentialai.uk
