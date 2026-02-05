# Coding Conventions

**Analysis Date:** 2026-02-05

## Naming Patterns

**Files:**
- Lowercase with hyphens: `multi-edit.ts`, `multi-edit-files.ts`, `editor.ts`
- Type definition files: `index.ts` in `types/` directory
- Test files: `{module}.test.ts` or `{module}.spec.ts`
- No capital letters except for type/interface names

**Functions:**
- camelCase for all function names: `handleMultiEdit`, `applyEdits`, `replaceString`, `findOccurrences`
- Async functions use same naming: `applyEdits()`, `handleMultiEdit()`
- Descriptive verbs for function names: `apply`, `replace`, `find`, `detect`, `validate`, `format`, `create`
- Private/helper functions use same public naming (no underscore prefix)

**Variables:**
- camelCase for all variables: `filePath`, `dryRun`, `createBackup`, `searchString`, `replaceAll`
- Boolean variables often prefixed with flag names: `dryRun`, `createBackup`, `replaceAll`, `success`
- Plural for arrays: `edits`, `files`, `results`, `conflicts`
- Const variables in UPPERCASE are not used (prefer typed constants)

**Types:**
- PascalCase for interfaces and types: `EditOperation`, `MultiEditInput`, `MultiEditResult`
- Suffixes: `Input` for input types, `Result` for output types, `Schema` for Zod validators
- Descriptive names reflecting purpose: `EditOperation`, `MultiEditFilesResult`, `EditResult`

**Schemas:**
- Zod schemas use UPPERCASE with `Schema` suffix: `EditOperationSchema`, `MultiEditInputSchema`
- Match TypeScript interface names closely: `EditOperation` → `EditOperationSchema`

## Code Style

**Formatting:**
- No explicit formatter configured (eslint/prettier not in use)
- 2-space indentation observed in all files
- Line length typically under 120 characters
- Consistent spacing around operators and colons

**Linting:**
- TypeScript strict mode enabled in `tsconfig.json`
- `forceConsistentCasingInFileNames: true` enforces filename casing
- No ESLint or Prettier configuration found
- Manual adherence to observed patterns required

## Import Organization

**Order:**
1. Standard library imports: `import * as fs from 'fs/promises'`
2. Third-party packages: `import { z } from 'zod'`
3. Internal imports with relative paths: `import { applyEdits } from '../core/editor.js'`
4. Type-only imports: `import type { EditOperation } from '../types/index.js'`

**Path Aliases:**
- No path aliases configured (no `baseUrl` in tsconfig)
- Relative imports use `../` to traverse directories
- Files imported with `.js` extension (ESM modules): `../core/editor.js`, `../types/index.js`
- Organized by layer: tools import from core, core has no dependencies on tools

## Error Handling

**Patterns:**
- Try-catch blocks wrap async operations and external calls
- Error checking uses `instanceof Error` check before accessing `.message`
- Fallback message for unknown error types: `'Unknown error'`
- Zod validation results checked with `.success` property: `validation.success`
- Validation errors transformed into readable messages: `validation.error.issues.map(i => ...)`
- Error messages include context: `Failed to edit file ${filePath}:`
- MCP responses use `isError: true` flag to indicate failures

**Patterns in `src/tools/multi-edit.ts`:**
```typescript
try {
  const result = await applyEdits(...);
  return { content: [...], isError: !result.success };
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return { content: [...], isError: true };
}
```

## Logging

**Framework:** Built-in `console` object

**Patterns:**
- `console.error()` used for diagnostic output
- Example in `src/index.ts` line 189: `console.error('EAIS MCP Multi-Edit Server running on stdio')`
- No structured logging library in use
- Errors logged via catch blocks, not proactively

## Comments

**When to Comment:**
- JSDoc comments on all exported functions and interfaces
- File-level comments describing module purpose
- TODO comments for unimplemented features: `// TODO: Implement` in `src/core/editor.ts` line 25
- Inline comments explain complex logic (e.g., overlap detection algorithm)

**JSDoc/TSDoc:**
- All public functions have JSDoc blocks
- Parameter documentation with `@param` tags
- Return type documentation with `@returns` tags
- Example from `src/core/editor.ts` line 11-17:
```typescript
/**
 * Apply multiple edits to a file atomically
 *
 * @param filePath - Absolute path to the file
 * @param edits - Array of edit operations
 * @param dryRun - If true, preview changes without applying
 * @returns Result of the multi-edit operation
 */
```

- All interface properties documented with comment lines
- Example from `src/types/index.ts` line 9-14:
```typescript
export interface EditOperation {
  /** Text to find in the file */
  old_string: string;
  /** Text to replace with */
  new_string: string;
  /** Replace all occurrences (default: false) */
  replace_all?: boolean;
}
```

## Function Design

**Size:** Small, focused functions (typically 20-50 lines)
- `replaceString()` in `src/core/editor.ts` is 25 lines, handles single responsibility
- `findOccurrences()` in `src/core/editor.ts` is 8 lines

**Parameters:**
- Use explicit parameters rather than objects where possible
- Function handlers accept `unknown` and validate: `handleMultiEdit(args: unknown)`
- Multiple related parameters grouped (e.g., `filePath`, `edits`, `dryRun`, `createBackup`)
- Optional boolean flags for configuration: `replaceAll: boolean = false`

**Return Values:**
- Structured return objects for operations: `{ content: string; replacedCount: number }`
- Promise-based returns for async operations: `Promise<MultiEditResult>`
- Complex results use defined interfaces: `MultiEditResult`, `EditResult`
- Error results include error property with message: `error?: string`

## Module Design

**Exports:**
- Only public functions and interfaces exported
- Named exports preferred over default exports
- Type-only exports for interfaces: `export type` not used (direct `export interface`)
- Example from `src/core/validator.ts`:
```typescript
export const EditOperationSchema = z.object({...});
export function validateMultiEditInput(input: unknown) {...}
```

**Barrel Files:**
- `src/types/index.ts` serves as central type export point
- Core utilities do NOT use barrel files (each module imports directly)
- Tools import specific functions: `import { applyEdits } from '../core/editor.js'`

**Module Organization:**
- `src/types/` - All TypeScript interfaces and type definitions
- `src/core/` - Business logic (editor, validator, reporter)
- `src/tools/` - MCP tool handlers (multi-edit, multi-edit-files)
- `src/index.ts` - MCP server setup and wiring

---

*Convention analysis: 2026-02-05*
