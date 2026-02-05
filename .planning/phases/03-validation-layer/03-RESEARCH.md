# Phase 3: Validation Layer - Research

**Researched:** 2026-02-05
**Domain:** Input validation, path security, error formatting
**Confidence:** HIGH

## Summary

This phase implements a validation layer that gates access to the editor by rejecting invalid inputs before any file operations occur. The research confirms that the existing Zod-based validation architecture is sound and needs enhancement rather than replacement.

Key findings:
1. Zod's `safeParse()` combined with `.superRefine()` provides the ideal pattern for collect-all-errors validation
2. Node.js `path.isAbsolute()` plus explicit `..` segment checking provides robust path validation
3. `fs.promises.realpath()` handles symlink resolution and implicitly verifies file existence
4. Discriminated union result types (success/error) provide clean TypeScript ergonomics

**Primary recommendation:** Extend existing `validator.ts` with path validation, duplicate detection, and structured error formatting. Use `superRefine()` for cross-field validation (duplicate old_strings). Keep fail-fast for schema validation, then collect-all for semantic validation.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^3.23.0 | Schema validation | Already in use, TypeScript-first, `safeParse()` pattern |
| node:path | Node 20+ | Path operations | Built-in, cross-platform, `isAbsolute()` |
| node:fs/promises | Node 20+ | File existence check | Built-in, `realpath()` resolves symlinks |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:buffer | Node 20+ | UTF-8 validation | Already used in editor.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom path check | path-validation npm | Extra dependency for simple check |
| Manual symlink resolution | fs.lstat + fs.readlink | More complex, realpath() handles it |

**Installation:**
```bash
# No new dependencies needed - all built-in or already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/core/
├── validator.ts      # Enhanced with path/duplicate validation
├── validation-types.ts  # ValidationResult type (optional, can stay in types/)
├── editor.ts         # Unchanged - assumes valid input
└── reporter.ts       # Enhanced for validation errors
```

### Pattern 1: Layered Validation
**What:** Schema validation first (Zod), then semantic validation (paths, duplicates), then I/O validation (file existence)
**When to use:** Always - separates concerns and minimizes I/O
**Example:**
```typescript
// Source: CONTEXT.md decisions - validation ordering
export async function validateMultiEditInputFull(
  input: unknown
): Promise<ValidationResult> {
  // Layer 1: Schema validation (synchronous, no I/O)
  const schemaResult = MultiEditInputSchema.safeParse(input);
  if (!schemaResult.success) {
    return { success: false, errors: formatZodErrors(schemaResult.error) };
  }

  // Layer 2: Semantic validation (synchronous, no I/O)
  const semanticErrors = validateSemantics(schemaResult.data);
  if (semanticErrors.length > 0) {
    return { success: false, errors: semanticErrors };
  }

  // Layer 3: I/O validation (async, file system)
  const ioErrors = await validateFileAccess(schemaResult.data);
  if (ioErrors.length > 0) {
    return { success: false, errors: ioErrors };
  }

  return { success: true, data: schemaResult.data };
}
```

### Pattern 2: Discriminated Union Result Type
**What:** `{ success: true, data: T } | { success: false, errors: ValidationError[] }`
**When to use:** All validation functions
**Example:**
```typescript
// Source: TypeScript discriminated union pattern
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };

export interface ValidationError {
  code: string;           // Machine-readable: 'RELATIVE_PATH', 'DUPLICATE_EDIT'
  message: string;        // Human-readable with received value
  path?: string[];        // JSON path: ['edits', '2', 'old_string']
  recovery_hint: string;  // Actionable guidance
}
```

### Pattern 3: Path Validation with Directory Traversal Prevention
**What:** Check absolute path AND reject `..` segments
**When to use:** Every file path before any file operation
**Example:**
```typescript
// Source: Node.js path.isAbsolute() + security best practices
import * as path from 'node:path';

export function validatePath(filePath: string): ValidationError | null {
  // Check absolute path
  if (!path.isAbsolute(filePath)) {
    return {
      code: 'RELATIVE_PATH',
      message: `Invalid path: got "${filePath}", expected absolute path starting with /`,
      path: ['file_path'],
      recovery_hint: 'Provide full absolute path like /home/user/project/file.ts',
    };
  }

  // Check for directory traversal
  if (filePath.includes('..')) {
    return {
      code: 'PATH_TRAVERSAL',
      message: `Invalid path: "${filePath}" contains ".." which is not allowed`,
      path: ['file_path'],
      recovery_hint: 'Use resolved absolute path without ".." segments',
    };
  }

  return null; // Valid
}
```

### Pattern 4: Duplicate Edit Detection
**What:** Find exact duplicate old_strings within same file's edits
**When to use:** Validation phase, before file operations
**Example:**
```typescript
// Source: CONTEXT.md decisions - reject exact duplicate old_strings only
export function detectDuplicateOldStrings(
  edits: EditOperation[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const seen = new Map<string, number>(); // old_string -> first index

  for (let i = 0; i < edits.length; i++) {
    const oldStr = edits[i].old_string;
    const firstIndex = seen.get(oldStr);

    if (firstIndex !== undefined) {
      const snippet = truncateForDisplay(oldStr, 30);
      errors.push({
        code: 'DUPLICATE_OLD_STRING',
        message: `Edit ${i + 1} of ${edits.length}: old_string='${snippet}' is duplicate of edit ${firstIndex + 1}`,
        path: ['edits', String(i), 'old_string'],
        recovery_hint: 'Remove duplicate edit or make old_string more specific',
      });
    } else {
      seen.set(oldStr, i);
    }
  }

  return errors;
}
```

### Pattern 5: File Existence with Symlink Resolution
**What:** Use `fs.promises.realpath()` which resolves symlinks AND checks existence
**When to use:** After schema/semantic validation, before any edit operations
**Example:**
```typescript
// Source: Node.js fs.promises.realpath() documentation
import * as fs from 'node:fs/promises';

export async function validateFileExists(
  filePath: string
): Promise<{ resolvedPath: string } | ValidationError> {
  try {
    const resolvedPath = await fs.realpath(filePath);
    return { resolvedPath };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === 'ENOENT') {
      return {
        code: 'FILE_NOT_FOUND',
        message: `File not found: ${filePath}`,
        path: ['file_path'],
        recovery_hint: 'Check that file exists and path is correct',
      };
    }
    if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
      return {
        code: 'PERMISSION_DENIED',
        message: `Permission denied: ${filePath}`,
        path: ['file_path'],
        recovery_hint: 'Check file permissions',
      };
    }
    if (nodeError.code === 'ELOOP') {
      return {
        code: 'SYMLINK_LOOP',
        message: `Too many symbolic links: ${filePath}`,
        path: ['file_path'],
        recovery_hint: 'Resolve symlink chain manually',
      };
    }

    return {
      code: 'FILE_ERROR',
      message: `Cannot access file: ${nodeError.message}`,
      path: ['file_path'],
      recovery_hint: 'Check file exists and is accessible',
    };
  }
}
```

### Anti-Patterns to Avoid
- **Mixing validation with execution:** Validation module should NOT read file contents, only check existence
- **Throwing exceptions for validation errors:** Use result types, save exceptions for unexpected failures
- **Validating after partial execution:** All validation before any file operations
- **Ignoring symlinks:** Always resolve to real path before editing

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path absolute check | Regex `/^\/.*$/` | `path.isAbsolute()` | Handles Windows UNC, edge cases |
| Symlink resolution | `fs.lstat` + loop | `fs.realpath()` | Handles nested links, ELOOP detection |
| JSON error path | Manual string building | Zod `.issues[].path` | Already tracked correctly |
| Error formatting | Ad-hoc string templates | Structured `ValidationError` type | Consistent, machine-parseable |

**Key insight:** Node.js path and fs modules handle OS-specific edge cases. Zod handles validation ergonomics. Don't reinvent these.

## Common Pitfalls

### Pitfall 1: path.isAbsolute() Doesn't Prevent Traversal
**What goes wrong:** `/home/user/../etc/passwd` is absolute but escapes intended directory
**Why it happens:** `isAbsolute()` only checks format, not security
**How to avoid:** Always check for `..` segments in addition to `isAbsolute()`
**Warning signs:** Tests pass but security review flags path handling

### Pitfall 2: Race Condition Between Validation and Edit
**What goes wrong:** File exists at validation time, deleted before edit
**Why it happens:** Time-of-check to time-of-use (TOCTOU) race
**How to avoid:** Handle ENOENT in editor as well, not just validation. Validation is optimization, not guarantee
**Warning signs:** Intermittent "file not found" errors on valid paths

### Pitfall 3: Forgetting Symlink Target Doesn't Exist
**What goes wrong:** Symlink exists but target is missing
**Why it happens:** `fs.access()` or `fs.stat()` follows symlinks by default
**How to avoid:** Use `fs.realpath()` which fails with ENOENT for broken symlinks
**Warning signs:** Validation passes but editor gets ENOENT

### Pitfall 4: Error Message Truncation Breaks Context
**What goes wrong:** Error shows `old_string='function...` but user can't identify which
**Why it happens:** Overly aggressive truncation
**How to avoid:** Include edit index AND snippet: "Edit 2 of 5: old_string='function foo...' is duplicate"
**Warning signs:** Support requests asking "which edit failed?"

### Pitfall 5: Validation Errors Not Machine-Parseable
**What goes wrong:** Claude can't programmatically extract what to fix
**Why it happens:** Free-form error messages without structure
**How to avoid:** JSON structure with `code`, `path`, `message` fields
**Warning signs:** Claude guesses at fixes instead of precisely targeting the issue

## Code Examples

Verified patterns from official sources:

### Zod superRefine for Cross-Edit Validation
```typescript
// Source: https://zod.dev/api - superRefine documentation
const EditOperationSchema = z.object({
  old_string: z.string().min(1, 'old_string cannot be empty'),
  new_string: z.string(),
  replace_all: z.boolean().optional().default(false),
});

const EditsArraySchema = z.array(EditOperationSchema)
  .min(1, 'At least one edit is required')
  .superRefine((edits, ctx) => {
    // Detect duplicate old_strings
    const seen = new Map<string, number>();
    for (let i = 0; i < edits.length; i++) {
      const oldStr = edits[i].old_string;
      const firstIndex = seen.get(oldStr);
      if (firstIndex !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate old_string at edit ${i + 1}, same as edit ${firstIndex + 1}`,
          path: [i, 'old_string'],
        });
      } else {
        seen.set(oldStr, i);
      }
    }
  });
```

### Zod Error Formatting for API Response
```typescript
// Source: https://zod.dev/error-formatting - flattenError
import { z } from 'zod';

function formatZodErrors(error: z.ZodError): ValidationError[] {
  return error.issues.map(issue => ({
    code: 'SCHEMA_VALIDATION',
    message: issue.message,
    path: issue.path.map(String),
    recovery_hint: getRecoveryHintForZodCode(issue.code),
  }));
}

function getRecoveryHintForZodCode(code: z.ZodIssueCode): string {
  switch (code) {
    case z.ZodIssueCode.too_small:
      return 'Provide required value';
    case z.ZodIssueCode.invalid_type:
      return 'Check value type matches schema';
    case z.ZodIssueCode.custom:
      return 'See message for details';
    default:
      return 'Check input format';
  }
}
```

### Complete Validation Function
```typescript
// Source: Combined patterns from research
export async function validateMultiEditInput(
  input: unknown
): Promise<ValidationResult<MultiEditInput>> {
  // 1. Schema validation with Zod
  const schemaResult = MultiEditInputSchema.safeParse(input);
  if (!schemaResult.success) {
    return {
      success: false,
      errors: formatZodErrors(schemaResult.error),
    };
  }

  const data = schemaResult.data;
  const errors: ValidationError[] = [];

  // 2. Path validation (synchronous)
  const pathError = validatePath(data.file_path);
  if (pathError) {
    errors.push(pathError);
  }

  // 3. Duplicate detection (synchronous)
  const duplicateErrors = detectDuplicateOldStrings(data.edits);
  errors.push(...duplicateErrors);

  // Fail fast on synchronous errors before I/O
  if (errors.length > 0) {
    return { success: false, errors };
  }

  // 4. File existence (async)
  const fileResult = await validateFileExists(data.file_path);
  if ('code' in fileResult) {
    return { success: false, errors: [fileResult] };
  }

  // Return validated data with resolved path
  return {
    success: true,
    data: { ...data, file_path: fileResult.resolvedPath },
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod .format() | Zod .flatten() or z.flattenError() | Zod v4 | Cleaner shallow error structure |
| fs.exists (deprecated) | fs.access or fs.realpath | Node 10+ | fs.exists was unreliable |
| Manual error message strings | Structured ValidationError type | Modern pattern | Machine-parseable errors |

**Deprecated/outdated:**
- `fs.exists()`: Deprecated since Node v1.0.0, use `fs.access()` or try/catch on operation
- `z.formatError()`: Deprecated in Zod v4, use `z.treeifyError()` or `z.flattenError()`

## Open Questions

Things that couldn't be fully resolved:

1. **Fail-fast vs collect-all within semantic validation**
   - What we know: CONTEXT.md says "Claude's Discretion"
   - What's unclear: Best UX when multiple semantic errors exist
   - Recommendation: Collect all synchronous errors, fail fast on async errors (I/O is expensive)

2. **Snippet truncation length**
   - What we know: CONTEXT.md says "Claude's Discretion"
   - What's unclear: Optimal length for Claude's context
   - Recommendation: 30-50 chars with ellipsis, include edit index for unique identification

3. **Windows path support**
   - What we know: `path.isAbsolute()` handles Windows paths correctly
   - What's unclear: Whether MCP server will run on Windows
   - Recommendation: Use Node.js path module consistently, test on Windows if needed

## Sources

### Primary (HIGH confidence)
- [Zod error customization](https://zod.dev/error-customization) - Error maps, custom messages
- [Zod error formatting](https://zod.dev/error-formatting) - `.flatten()`, `.format()` patterns
- [Node.js path module](https://nodejs.org/api/path.html) - `isAbsolute()`, `resolve()`, `normalize()`
- [Node.js fs module](https://nodejs.org/api/fs.html) - `realpath()`, `access()`, error codes
- Existing codebase: `src/core/validator.ts`, `src/core/editor.ts`, `src/core/reporter.ts`

### Secondary (MEDIUM confidence)
- [StackHawk path traversal guide](https://www.stackhawk.com/blog/node-js-path-traversal-guide-examples-and-prevention/) - Security patterns verified with Node.js docs
- [TypeScript discriminated unions](https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html) - Result type pattern

### Tertiary (LOW confidence)
- None - all findings verified with authoritative sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing dependencies with verified patterns
- Architecture: HIGH - Patterns verified against official Zod and Node.js docs
- Pitfalls: MEDIUM - Based on security best practices and Node.js documentation

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - stable domain, Node.js and Zod APIs mature)
