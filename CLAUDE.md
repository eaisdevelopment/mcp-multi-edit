# CLAUDE.md - EAIS MCP Multi-Edit Server

## Project Overview

Production-quality MCP server providing atomic multi-edit capabilities for Claude Code and Claude Desktop. Enables multiple find-and-replace operations in a single tool call, reducing context usage and increasing delivery speed.

## Authorship
Always use this information for GIT or Other repositories and marketplaces.
- Name: Pavlo Sidelov
- Email: pavlo@essentialai.uk
- Company: Essential AI Solutions Ltd.


## Build Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run test         # Run tests
npm run test:watch   # Watch mode
npm run dev          # Development with tsx watch
```

## Technology Stack

- TypeScript 5.4+ (strict mode)
- @modelcontextprotocol/sdk (MCP server framework)
- Zod (input validation)
- Vitest (testing)
- Node.js 20+

## Core Principles

- **Atomic Operations**: All edits in a call succeed or none apply
- **Type Safety**: Full TypeScript with strict mode
- **Test-Driven**: Write tests before implementation (TDD)
- **Production Quality**: 90%+ coverage, comprehensive error handling
- **Community Ready**: Clear docs, MIT license, npm publishing

## Tools Provided

### 1. `multi_edit`
Multiple string replacements in a **single file** atomically.

**Input Schema:**
```json
{
  "file_path": "string (absolute path)",
  "edits": [
    {
      "old_string": "string (text to find)",
      "new_string": "string (replacement)",
      "replace_all": "boolean (default: false)"
    }
  ],
  "dry_run": "boolean (default: false)"
}
```

### 2. `multi_edit_files`
Coordinated edits across **multiple files** atomically.

**Input Schema:**
```json
{
  "files": [
    {
      "file_path": "string",
      "edits": [/* same as multi_edit */]
    }
  ],
  "dry_run": "boolean (default: false)"
}
```

## Package Info

- Name: `@anthropic-community/eais-mcp-multi-edit`
- Registry: npm public
- License: MIT

## Project Structure

```
src/
├── index.ts              # MCP server entry point
├── tools/
│   ├── multi-edit.ts     # Single file multi-edit tool
│   └── multi-edit-files.ts  # Multi-file edit tool
├── core/
│   ├── editor.ts         # File editing engine
│   ├── validator.ts      # Zod validation schemas
│   └── reporter.ts       # Result formatting
└── types/
    └── index.ts          # TypeScript types
```

## Development Workflow

1. Write failing test first (TDD)
2. Implement minimal code to pass
3. Refactor if needed
4. Maintain 90%+ coverage

## Key Features to Implement

| Feature | Priority | Description |
|---------|----------|-------------|
| Atomic edits | HIGH | All succeed or none apply |
| Dry-run | HIGH | Preview without changes |
| Replace all | HIGH | Optional flag per edit |
| Error reporting | HIGH | Clear, actionable messages |
| Backup files | MEDIUM | Create .bak before edit |
| Conflict detection | MEDIUM | Warn on overlapping edits |

## Error Handling

- Return clear, actionable error messages
- Never leave files in partial state
- Log errors for debugging
- Use `isError: true` in MCP response for failures

## Testing Strategy

1. **Unit tests** (`tests/unit/`)
   - Test editor.ts logic in isolation
   - Test validator.ts schemas
   - Mock file system operations

2. **Integration tests** (`tests/integration/`)
   - Test full MCP server with real client
   - Test actual file operations on fixtures

3. **Edge cases**
   - Non-existent files
   - Permission errors
   - Overlapping edits
   - Empty edits array
   - Unicode content
   - Large files

## Implementation Order

1. `src/types/index.ts` - Define all types
2. `src/core/validator.ts` - Zod schemas
3. `src/core/editor.ts` - File editing logic (with tests)
4. `src/core/reporter.ts` - Result formatting
5. `src/tools/multi-edit.ts` - Single file tool
6. `src/tools/multi-edit-files.ts` - Multi-file tool
7. `src/index.ts` - MCP server wiring
8. Integration tests
9. README and documentation
