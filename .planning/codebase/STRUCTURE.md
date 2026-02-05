# Codebase Structure

**Analysis Date:** 2026-02-05

## Directory Layout

```
mcp-multi-edit/
├── src/                          # Source TypeScript code
│   ├── index.ts                  # MCP server entry point
│   ├── types/
│   │   └── index.ts              # TypeScript type definitions
│   ├── core/                      # Business logic and utilities
│   │   ├── editor.ts             # File editing engine
│   │   ├── validator.ts          # Input validation (Zod schemas)
│   │   └── reporter.ts           # Result formatting for responses
│   └── tools/                     # MCP tool handler implementations
│       ├── multi-edit.ts         # Single-file edit handler
│       └── multi-edit-files.ts   # Multi-file edit handler
├── tests/                        # Test suite
│   ├── unit/                     # Unit tests
│   │   ├── editor.test.ts        # Editor engine tests
│   │   └── validator.test.ts     # Validator tests
│   ├── integration/              # Integration tests
│   │   └── server.test.ts        # Full MCP server tests
│   └── fixtures/                 # Test data
│       └── sample-files/         # Sample files for testing
│           └── example.ts        # Example TypeScript file
├── dist/                         # Compiled JavaScript (generated)
├── .planning/                    # GSD documentation
│   └── codebase/                 # Codebase analysis docs
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript compiler config
├── vitest.config.ts              # Vitest configuration
├── CLAUDE.md                      # Project specifications
├── README.md                      # User-facing documentation
├── LICENSE                       # MIT license
└── .gitignore                    # Git ignore rules
```

## Directory Purposes

**`src/`:**
- Purpose: All production TypeScript source code
- Contains: Server logic, handlers, validators, types, editor engine
- Key files: `index.ts` (server), `core/editor.ts` (core logic)

**`src/types/`:**
- Purpose: Centralized TypeScript interface definitions
- Contains: EditOperation, MultiEditInput, MultiEditResult, and result types
- Key files: `index.ts` (all type exports)

**`src/core/`:**
- Purpose: Reusable business logic and validation
- Contains: File editing engine, input validation schemas, result formatting
- Key files: `editor.ts` (string replacement), `validator.ts` (Zod schemas), `reporter.ts` (response formatting)

**`src/tools/`:**
- Purpose: MCP tool handler implementations
- Contains: Handler functions for multi_edit and multi_edit_files tools
- Key files: `multi-edit.ts` (single file), `multi-edit-files.ts` (multi-file)

**`tests/unit/`:**
- Purpose: Isolated unit tests for core components
- Contains: Tests for editor functions, validator schemas
- Key files: `editor.test.ts`, `validator.test.ts`

**`tests/integration/`:**
- Purpose: End-to-end tests with MCP server
- Contains: Full server startup, request/response flows
- Key files: `server.test.ts`

**`tests/fixtures/`:**
- Purpose: Test data and sample files
- Contains: Sample TypeScript files used in tests
- Key files: `sample-files/example.ts`

**`dist/`:**
- Purpose: Compiled JavaScript output (gitignored)
- Generated: By `npm run build` from src/
- Contains: .js and .d.ts files matching src/ structure

## Key File Locations

**Entry Points:**
- `src/index.ts`: MCP server startup, tool registration, request routing (line 1-192)
- CLI: Invoked via `npm run dev` or `eais-mcp-multi-edit` bin target (package.json line 8)

**Configuration:**
- `package.json`: Dependencies, build scripts, publish settings
- `tsconfig.json`: TypeScript strict mode, ES2022 target, sourcemaps enabled
- `vitest.config.ts`: Test runner config with v8 coverage

**Core Logic:**
- `src/core/editor.ts`: applyEdits function (line 19), replaceString (line 58), findOccurrences (line 38)
- `src/core/validator.ts`: EditOperationSchema (line 10), MultiEditInputSchema (line 19), MultiEditFilesInputSchema (line 29)

**Testing:**
- `tests/unit/editor.test.ts`: Editor function tests
- `tests/unit/validator.test.ts`: Zod schema validation tests
- `tests/integration/server.test.ts`: MCP server integration tests

**Types:**
- `src/types/index.ts`: All TypeScript interfaces (EditOperation, MultiEditInput, MultiEditResult, etc.)

## Naming Conventions

**Files:**
- Kebab-case for multi-word files: `multi-edit.ts`, `multi-edit-files.ts`
- Index files: `index.ts` for directory exports
- Test files: `.test.ts` or `.spec.ts` suffix
- Config files: Descriptive names like `vitest.config.ts`, `tsconfig.json`

**Directories:**
- Lowercase, plural for collections: `src/types/`, `src/tools/`, `tests/unit/`
- Functional names: `core/` for business logic, `tools/` for handlers

**TypeScript:**
- Interfaces: PascalCase, prefixed by type context (EditOperation, MultiEditResult)
- Functions: camelCase (applyEdits, findOccurrences, validateMultiEditInput)
- Types: PascalCase (EditResult, MultiEditInput)
- Constants: UPPER_SNAKE_CASE (TOOLS array, schema objects)

**Functions:**
- Handler functions: prefixed handle* (handleMultiEdit, handleMultiEditFiles)
- Validation functions: validate*/check*/detect* (validateMultiEditInput, isAbsolutePath, detectOverlappingEdits)
- Utility functions: verb-first (replaceString, findOccurrences, formatMultiEditResult)

**Variables:**
- camelCase for all variables
- Descriptive names: fileContent, editResults, originalContents
- Prefixes for maps/sets: originalContents (Map), conflicts (Set)

## Where to Add New Code

**New Feature:**
- Tool implementation: `src/tools/[tool-name].ts` with handler function
- Core logic: `src/core/[domain].ts` for reusable operations
- Types: Add interfaces to `src/types/index.ts`
- Tests: `tests/unit/[domain].test.ts` for logic, `tests/integration/server.test.ts` for end-to-end

**New Component/Module:**
- If it's a reusable operation: Create file in `src/core/`
- If it's a tool handler: Create file in `src/tools/`
- If it's data: Add interface to `src/types/index.ts`
- Always create corresponding test file in `tests/unit/` or `tests/integration/`

**Utilities:**
- Shared helpers: Add to `src/core/` (editor.ts for file ops, validator.ts for validation)
- Global utilities: Create new file in `src/core/` with clear responsibility
- Test utilities: Create in `tests/` directory

**Example - Adding a new tool:**
1. Create handler: `src/tools/new-tool.ts` with handleNewTool function
2. Create types: Add NewToolInput, NewToolResult to `src/types/index.ts`
3. Create schema: Add NewToolInputSchema to `src/core/validator.ts`
4. Register tool: Add tool definition to TOOLS array in `src/index.ts` (line 32-124)
5. Wire handler: Add case to CallToolRequestSchema handler in `src/index.ts` (line 132-183)
6. Create tests: `tests/unit/new-tool.test.ts` and add integration test

## Special Directories

**`dist/`:**
- Purpose: Compiled JavaScript output
- Generated: Yes (by TypeScript compiler)
- Committed: No (.gitignore excludes)
- Build command: `npm run build`

**`.planning/`:**
- Purpose: GSD codebase analysis documents
- Generated: Yes (by GSD mapper)
- Committed: Yes (tracked in git)
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md

**`.idea/`:**
- Purpose: JetBrains IDE project settings
- Generated: Yes (by IDE)
- Committed: No (gitignored in spec, but added to repo)
- Should be: Removed from tracking

**`.qodo/`:**
- Purpose: Qodo AI code review tool cache
- Generated: Yes
- Committed: No (should be ignored)

**`specification/`:**
- Purpose: Project specification files
- Generated: No (manually created)
- Committed: Yes
- Contents: specification.txt

---

*Structure analysis: 2026-02-05*
