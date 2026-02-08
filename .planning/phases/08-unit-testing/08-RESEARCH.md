# Phase 8: Unit Testing - Research

**Researched:** 2026-02-08
**Domain:** Vitest unit testing with filesystem mocking for TypeScript MCP server
**Confidence:** HIGH

## Summary

Phase 8 requires comprehensive unit tests for `editor.ts` and `validator.ts`. Existing tests cover approximately 42 test cases across both files but leave significant gaps: `editor.ts` is at 90.76% statement coverage (missing backup/error formatting functions), while `validator.ts` is at only 32.4% coverage (missing `validatePath`, `detectDuplicateOldStrings`, `formatZodErrors`, `validateMultiEditInputFull`, `validateFileExists`, `detectDuplicateFilePaths`, and `validateMultiEditFilesInputFull`).

The project uses Vitest 1.6.1 with ESM (`"type": "module"` in package.json), TypeScript in strict mode targeting ES2022/NodeNext modules. The existing tests use real filesystem operations (temp files in `os.tmpdir()`) for I/O tests rather than memfs. The phase requirements specify using memfs for speed and isolation, which will require installing `memfs` as a dev dependency and using `vi.mock` to intercept `node:fs/promises` and `node:fs` imports.

The key challenge is that `validator.ts` imports `fs` from `node:fs/promises` for `validateFileExists` and `detectDuplicateFilePaths` (which call `fs.realpath`). These async functions need memfs mocking to test without hitting the real filesystem. Meanwhile, `editor.ts` has pure functions (`applyEditsToContent`, `replaceString`, `replaceStringCaseAware`, `findAllMatchPositions`, `getLineNumber`, `findOccurrences`) that need no mocking, plus I/O functions (`readFileValidated`, `atomicWrite`, `createBackup`, `applyEdits`) that need filesystem mocking.

**Primary recommendation:** Split testing into two plans: (1) pure logic tests for editor.ts and synchronous validator.ts functions (no mocking needed, fast), and (2) filesystem-dependent tests using memfs for async validator.ts functions and editor.ts I/O functions.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^1.6.0 (installed: 1.6.1) | Test runner | Already in project, ESM-native, TypeScript-native |
| @vitest/coverage-v8 | ^1.6.0 (installed: 1.6.1) | Coverage reporting | Already in project |
| memfs | ^4.x (latest: 4.56.10) | In-memory filesystem | Vitest official docs recommend it for fs mocking |
| zod | ^3.23.0 (installed) | Schema validation | Already in project, testing its schemas |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | The core stack covers all requirements |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| memfs | Real temp files (current approach) | Real files are slower, leave artifacts, may fail on CI due to permissions. memfs is faster and deterministic |
| memfs | mock-fs | mock-fs patches `fs` globally which is fragile; memfs provides a proper Volume API |

**Installation:**
```bash
npm install --save-dev memfs
```

## Architecture Patterns

### Recommended Test Structure
```
tests/
  unit/
    editor.test.ts           # EXISTING - extend with missing coverage
    editor-io.test.ts         # NEW - fs-dependent editor functions with memfs
    validator.test.ts         # EXISTING - extend with missing coverage
    validator-async.test.ts   # NEW - async validator functions with memfs
  fixtures/
    sample-files/
      example.ts              # EXISTING test fixture
  integration/
    server.test.ts            # EXISTING (Phase 9 scope, not Phase 8)
```

### Pattern 1: Pure Function Testing (No Mocking)
**What:** Test pure functions that take input and return output with no side effects.
**When to use:** `applyEditsToContent`, `replaceString`, `replaceStringCaseAware`, `findAllMatchPositions`, `getLineNumber`, `findOccurrences`, `formatFileError`, `formatBackupError` in editor.ts. `validatePath`, `detectOverlappingEdits`, `detectDuplicateOldStrings`, `formatZodErrors`, `validateMultiEditInput`, `validateMultiEditFilesInput`, `isAbsolutePath` in validator.ts.
**Example:**
```typescript
// Source: Existing codebase pattern in tests/unit/editor.test.ts
import { describe, it, expect } from 'vitest';
import { replaceStringCaseAware } from '../../src/core/editor.js';

describe('replaceStringCaseAware', () => {
  it('should replace case-insensitively when flag is set', () => {
    const result = replaceStringCaseAware('Hello World', 'hello', 'hi', false, true);
    expect(result.content).toBe('hi World');
    expect(result.replacedCount).toBe(1);
  });
});
```

### Pattern 2: Filesystem Mocking with memfs + vi.mock
**What:** Mock `node:fs/promises` and `node:fs` to use memfs in-memory filesystem.
**When to use:** Testing `readFileValidated`, `atomicWrite`, `createBackup`, `applyEdits`, `validateFileExists`, `detectDuplicateFilePaths`, `validateMultiEditInputFull`, `validateMultiEditFilesInputFull`.
**Example:**
```typescript
// Source: https://vitest.dev/guide/mocking/file-system
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fs, vol } from 'memfs';

// vi.mock is hoisted to top of file automatically
vi.mock('node:fs', () => ({ default: fs, ...fs }));
vi.mock('node:fs/promises', () => ({ default: fs.promises, ...fs.promises }));

beforeEach(() => {
  vol.reset();
});

it('should read file content', async () => {
  vol.fromJSON({ '/test/file.txt': 'hello world' });
  const { readFileValidated } = await import('../../src/core/editor.js');
  const content = await readFileValidated('/test/file.txt');
  expect(content).toBe('hello world');
});
```

### Pattern 3: Zod Schema Boundary Testing
**What:** Test schemas with valid input (expect `success: true` and correct parsed data) and invalid input (expect `success: false` with correct error codes/paths).
**When to use:** Testing `MultiEditInputSchema`, `MultiEditFilesInputSchema`, `EditOperationSchema`.
**Example:**
```typescript
// Source: Zod testing best practices
import { describe, it, expect } from 'vitest';
import { MultiEditInputSchema } from '../../src/core/validator.js';

describe('MultiEditInputSchema', () => {
  it('should set default values for optional fields', () => {
    const result = MultiEditInputSchema.safeParse({
      file_path: '/test.ts',
      edits: [{ old_string: 'foo', new_string: 'bar' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dry_run).toBe(false);
      expect(result.data.backup).toBe(true);
      expect(result.data.include_content).toBe(false);
    }
  });

  it('should produce ValidationError with correct code for empty old_string', () => {
    const result = MultiEditInputSchema.safeParse({
      file_path: '/test.ts',
      edits: [{ old_string: '', new_string: 'bar' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].code).toBe('too_small');
    }
  });
});
```

### Anti-Patterns to Avoid
- **Testing implementation details:** Do not test private helper behavior through internal state. Test public function inputs/outputs only.
- **Over-mocking:** Do not mock `applyEditsToContent` when testing `applyEdits` -- the pure logic should run for real; only mock the filesystem layer.
- **Dynamic imports inside every test:** The existing tests use `await import(...)` inside each `it()` block. This pattern is slow and unnecessary. Use top-level static imports instead, which work with vi.mock hoisting.
- **Forgetting vol.reset():** Every `beforeEach` using memfs MUST call `vol.reset()` to prevent state leaking between tests.
- **Testing Zod's own validation logic:** Do not test that Zod correctly validates types (e.g., "string rejects number"). Test that YOUR schemas encode the right constraints (min lengths, default values, required fields).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| In-memory filesystem | Custom Map-based fs mock | memfs `vol` + `fs` | memfs implements full Node.js fs API including `realpath`, `stat`, `chmod`, `rename` |
| Test coverage tracking | Manual assertion counting | `@vitest/coverage-v8` with `--coverage` | Already installed, generates lcov/html/json reports |
| Mock function tracking | Manual call counters | `vi.fn()` and `vi.spyOn()` | Vitest built-in, tracks calls, arguments, return values |
| Test file organization | Flat test files | `describe`/`it` nesting by function | Natural grouping that matches source structure |

**Key insight:** The entire testing infrastructure is already set up (Vitest config, coverage, test directories). The work is writing the test cases themselves, not infrastructure.

## Common Pitfalls

### Pitfall 1: ESM vi.mock Hoisting with node: Protocol
**What goes wrong:** `vi.mock('fs/promises')` does not intercept `import from 'node:fs/promises'`. The source code uses `node:fs/promises` and `node:fs`.
**Why it happens:** Node.js treats `fs/promises` and `node:fs/promises` as different module specifiers.
**How to avoid:** Mock BOTH specifiers: `vi.mock('node:fs')` AND `vi.mock('node:fs/promises')`. Match exactly what the source code imports.
**Warning signs:** Tests pass but filesystem calls hit the real disk. Tests fail with "file not found" errors pointing to memfs paths.

### Pitfall 2: memfs Missing node:buffer isUtf8
**What goes wrong:** `editor.ts` imports `isUtf8` from `buffer` (Node.js built-in). memfs does not provide this function. When testing `readFileValidated` with memfs, files written via `vol.fromJSON` are always valid UTF-8 strings.
**Why it happens:** memfs only mocks `fs` module, not `buffer` module.
**How to avoid:** For UTF-8 validation testing, either: (a) use `vol.fromJSON` with string content (which is always valid UTF-8) and test the happy path, or (b) for invalid UTF-8 testing, mock `readFile` to return a Buffer with invalid bytes, or (c) use `vi.mock('buffer')` to control `isUtf8` return value.
**Warning signs:** Cannot reproduce the "invalid UTF-8" error path in tests.

### Pitfall 3: memfs realpath Behavior
**What goes wrong:** `validator.ts` uses `fs.realpath()` for both existence checking and symlink resolution. memfs supports `realpath` but symlink behavior may differ subtly from real fs.
**Why it happens:** memfs implements core POSIX semantics but may not perfectly replicate all platform-specific behaviors.
**How to avoid:** Test the main paths (file exists, file not found, permission denied) and trust memfs for basic operations. For symlink-specific tests, verify memfs supports `symlinkSync` before relying on it.
**Warning signs:** Tests pass locally but fail on CI, or vice versa.

### Pitfall 4: Shared Mutable State Between Tests
**What goes wrong:** One test creates files in memfs volume, next test sees them unexpectedly.
**Why it happens:** memfs `vol` is a singleton shared across all tests in a file.
**How to avoid:** Always call `vol.reset()` in `beforeEach`. Never rely on test execution order.
**Warning signs:** Tests pass individually but fail when run together.

### Pitfall 5: Path Module is NOT Mocked
**What goes wrong:** `path.isAbsolute()`, `path.dirname()`, `path.join()` etc. still use real Node.js path module, which is correct -- they're pure functions. But `path.sep` on macOS is `/` while on Windows it's `\`.
**Why it happens:** memfs mocks fs, not path. Path semantics are platform-dependent.
**How to avoid:** Only use `/`-based paths in tests (POSIX convention). The project already targets Node 20+ on unix-like systems.
**Warning signs:** Tests fail on Windows CI runners (if applicable).

### Pitfall 6: atomicWrite Uses crypto.randomBytes
**What goes wrong:** `atomicWrite` creates temp files with random hex suffixes. In memfs, this works fine but the temp file paths are unpredictable.
**Why it happens:** `crypto` module is not mocked and doesn't need to be.
**How to avoid:** Don't assert on exact temp file names. Assert on final file content after `atomicWrite` completes. The atomic write pattern (write temp + rename) works correctly in memfs.
**Warning signs:** Tests try to assert temp file names and fail intermittently.

### Pitfall 7: Coverage Gaps in Error Formatting Functions
**What goes wrong:** `formatFileError` and `formatBackupError` in editor.ts are at 0% coverage. These are pure functions that take errors and format them -- easy to test but easy to forget.
**Why it happens:** They're called inside catch blocks during I/O operations, so pure-function tests are needed.
**How to avoid:** Test these functions directly with constructed Error objects that have `.code` properties (ENOENT, EACCES, EPERM, ENOSPC, EROFS).
**Warning signs:** Coverage report shows these functions uncovered.

## Code Examples

Verified patterns from official sources and codebase analysis:

### Setting Up memfs Mock for This Project
```typescript
// Source: https://vitest.dev/guide/mocking/file-system + project analysis
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fs, vol } from 'memfs';

// Mock both node:fs and node:fs/promises to match source imports
vi.mock('node:fs', () => ({ default: fs, ...fs }));
vi.mock('node:fs/promises', () => ({ default: fs.promises, ...fs.promises }));

beforeEach(() => {
  vol.reset();
});
```

### Testing formatFileError (Pure Function, No Mock)
```typescript
// Source: Codebase analysis of src/core/editor.ts lines 259-277
import { describe, it, expect } from 'vitest';
import { formatFileError } from '../../src/core/editor.js';

describe('formatFileError', () => {
  it('should format ENOENT as file not found', () => {
    const error = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    expect(formatFileError(error, '/test.txt')).toContain('File not found');
  });

  it('should format EACCES as permission denied', () => {
    const error = Object.assign(new Error('EACCES'), { code: 'EACCES' });
    expect(formatFileError(error, '/test.txt')).toContain('Permission denied');
  });

  it('should pass through UTF-8 errors unchanged', () => {
    const error = new Error('File contains invalid UTF-8 encoding: /test.txt');
    expect(formatFileError(error, '/test.txt')).toContain('UTF-8');
  });

  it('should handle non-Error objects', () => {
    expect(formatFileError('string error', '/test.txt')).toContain('Unknown file error');
  });
});
```

### Testing validatePath (Pure Function, No Mock)
```typescript
// Source: Codebase analysis of src/core/validator.ts lines 72-95
import { describe, it, expect } from 'vitest';
import { validatePath } from '../../src/core/validator.js';

describe('validatePath', () => {
  it('should return null for valid absolute path', () => {
    expect(validatePath('/home/user/file.ts')).toBeNull();
  });

  it('should return RELATIVE_PATH error for relative path', () => {
    const error = validatePath('relative/path.ts');
    expect(error).not.toBeNull();
    expect(error!.code).toBe('RELATIVE_PATH');
    expect(error!.recovery_hint).toBeDefined();
  });

  it('should return PATH_TRAVERSAL error for path with ..', () => {
    const error = validatePath('/home/user/../etc/passwd');
    expect(error).not.toBeNull();
    expect(error!.code).toBe('PATH_TRAVERSAL');
  });
});
```

### Testing detectDuplicateOldStrings (Pure Function, No Mock)
```typescript
// Source: Codebase analysis of src/core/validator.ts lines 182-205
import { describe, it, expect } from 'vitest';
import { detectDuplicateOldStrings } from '../../src/core/validator.js';

describe('detectDuplicateOldStrings', () => {
  it('should return empty array for unique old_strings', () => {
    const edits = [
      { old_string: 'foo', new_string: 'bar' },
      { old_string: 'baz', new_string: 'qux' },
    ];
    expect(detectDuplicateOldStrings(edits)).toEqual([]);
  });

  it('should detect duplicate old_strings', () => {
    const edits = [
      { old_string: 'foo', new_string: 'bar' },
      { old_string: 'foo', new_string: 'baz' },
    ];
    const errors = detectDuplicateOldStrings(edits);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('DUPLICATE_OLD_STRING');
    expect(errors[0].path).toEqual(['edits', '1', 'old_string']);
  });
});
```

### Testing formatZodErrors (Pure Function, No Mock)
```typescript
// Source: Codebase analysis of src/core/validator.ts lines 210-244
import { describe, it, expect } from 'vitest';
import { formatZodErrors, MultiEditInputSchema } from '../../src/core/validator.js';

describe('formatZodErrors', () => {
  it('should convert Zod too_small issue for edits', () => {
    const result = MultiEditInputSchema.safeParse({
      file_path: '/test.ts',
      edits: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toMatch(/SCHEMA_/);
      expect(errors[0].recovery_hint).toBeDefined();
    }
  });
});
```

### Testing validateFileExists with memfs
```typescript
// Source: Vitest docs + codebase analysis
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fs, vol } from 'memfs';

vi.mock('node:fs', () => ({ default: fs, ...fs }));
vi.mock('node:fs/promises', () => ({ default: fs.promises, ...fs.promises }));

beforeEach(() => {
  vol.reset();
});

describe('validateFileExists', () => {
  it('should return resolvedPath for existing file', async () => {
    vol.fromJSON({ '/test/file.txt': 'content' });
    const { validateFileExists } = await import('../../src/core/validator.js');
    const result = await validateFileExists('/test/file.txt');
    expect(result).toHaveProperty('resolvedPath');
  });

  it('should return FILE_NOT_FOUND for missing file', async () => {
    const { validateFileExists } = await import('../../src/core/validator.js');
    const result = await validateFileExists('/nonexistent.txt');
    expect(result).toHaveProperty('code', 'FILE_NOT_FOUND');
  });
});
```

## Inventory of What Needs Testing

### editor.ts Functions and Current Coverage

| Function | Current Coverage | Pure/IO | Tests Needed |
|----------|-----------------|---------|--------------|
| `getLineNumber` | covered via applyEditsToContent | Pure | Add direct tests for edge cases |
| `findAllMatchPositions` | covered via applyEditsToContent | Pure | Add direct tests (empty string, case-insensitive) |
| `getMatchLineNumbers` | covered via applyEditsToContent | Pure | Add direct tests |
| `replaceStringCaseAware` | partially covered | Pure | Add case-insensitive tests, replace_all+case_insensitive combo |
| `applyEditsToContent` | well covered (existing tests) | Pure | Extend: Unicode, large files, edge cases |
| `readFileValidated` | partially covered | IO | memfs tests: valid UTF-8, existence |
| `atomicWrite` | partially covered | IO | memfs tests: write+rename, cleanup on error |
| `formatFileError` | NOT covered | Pure | Direct tests with constructed errors |
| `createBackup` | NOT covered (line 287-296) | IO | memfs tests: backup creation, permission preservation |
| `formatBackupError` | NOT covered (line 305-320) | Pure | Direct tests with constructed errors |
| `applyEdits` | partially covered (file I/O tests) | IO | memfs tests for backup path, dry-run with backup |
| `findOccurrences` | well covered | Pure | Already tested |
| `replaceString` | well covered | Pure | Already tested |

### validator.ts Functions and Current Coverage

| Function | Current Coverage | Pure/IO | Tests Needed |
|----------|-----------------|---------|--------------|
| `EditOperationSchema` | covered via validateMultiEditInput | Schema | Already tested |
| `MultiEditInputSchema` | covered | Schema | Extend: default values, type errors |
| `MultiEditFilesInputSchema` | partially covered | Schema | Extend: nested validation, default values |
| `validateMultiEditInput` | covered | Pure | Already tested |
| `validateMultiEditFilesInput` | covered | Pure | Already tested |
| `isAbsolutePath` | covered | Pure | Already tested |
| `validatePath` | NOT covered | Pure | Test: absolute, relative, traversal |
| `validateFileExists` | NOT covered | IO | memfs: exists, ENOENT, EACCES, ELOOP |
| `detectOverlappingEdits` | covered | Pure | Already tested |
| `detectDuplicateOldStrings` | NOT covered | Pure | Test: no dupes, single dupe, multiple dupes |
| `formatZodErrors` | NOT covered | Pure | Test: too_small, invalid_type, invalid_string, default |
| `validateMultiEditInputFull` | NOT covered | IO | memfs: full pipeline Layer 1-4 |
| `detectDuplicateFilePaths` | NOT covered | IO | memfs: no dupes, symlink dupes |
| `validateMultiEditFilesInputFull` | NOT covered | IO | memfs: full 5-layer pipeline |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Real temp files for fs tests | memfs in-memory filesystem | memfs 4.x stable | 10x faster tests, no cleanup needed, CI-safe |
| `require()` in tests | ESM `import` with vi.mock hoisting | Vitest 1.x | Project uses `"type": "module"`, all imports must use ESM |
| jest.mock | vi.mock with factory or __mocks__ | Vitest migration | Same API shape, vi.mock auto-hoists |

**Deprecated/outdated:**
- `mock-fs`: Last major update was 2023. memfs is the Vitest-recommended approach.
- `__mocks__/fs.cjs` pattern: Works but CJS files in an ESM project are awkward. Prefer `vi.mock` with factory in test files.

## Open Questions

1. **memfs `chmod`/`stat` support for backup tests**
   - What we know: `createBackup` calls `fs.stat` and `fs.chmod`. memfs supports these APIs.
   - What's unclear: Whether memfs's `stat.mode` returns meaningful values for permission testing.
   - Recommendation: Write tests that verify `createBackup` calls stat+chmod. If memfs mode values are unreliable, use `vi.spyOn` on specific fs methods to verify they were called with correct arguments.

2. **Dynamic import pattern in existing tests**
   - What we know: Existing editor.test.ts uses `await import('../../src/core/editor.js')` inside each `it()` block. This works but is slow.
   - What's unclear: Whether switching to top-level imports will break anything with vi.mock hoisting.
   - Recommendation: For NEW test files, use top-level static imports. For existing files being extended, keep the existing pattern for consistency within the file unless refactoring is scoped.

3. **memfs and `buffer.isUtf8` interaction**
   - What we know: `readFileValidated` reads raw Buffer and checks `isUtf8(buffer)`. memfs `writeFileSync` with string content produces valid UTF-8 buffers.
   - What's unclear: Whether memfs `readFile` returns a proper Buffer that `isUtf8` can evaluate.
   - Recommendation: Test the happy path with memfs. For the invalid UTF-8 path, mock `isUtf8` via `vi.mock('buffer')` or write raw bytes via `vol.writeFileSync` with a Buffer.

## Sources

### Primary (HIGH confidence)
- Vitest v1.6 Mocking Guide: https://v1.vitest.dev/guide/mocking - vi.mock hoisting, factory functions, importOriginal
- Vitest File System Mocking Guide: https://vitest.dev/guide/mocking/file-system - Official memfs integration pattern
- Project source code: `src/core/editor.ts`, `src/core/validator.ts`, `src/core/errors.ts`, `src/core/reporter.ts`, `src/types/index.ts`
- Existing tests: `tests/unit/editor.test.ts`, `tests/unit/validator.test.ts`
- Project configuration: `vitest.config.ts`, `package.json`, `tsconfig.json`

### Secondary (MEDIUM confidence)
- memfs npm page (version 4.56.10 latest): https://www.npmjs.com/package/memfs
- Zod testing patterns: https://stevekinney.com/courses/full-stack-typescript/testing-zod-schema

### Tertiary (LOW confidence)
- memfs chmod/stat behavior: Based on GitHub readme claims, not verified with test

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vitest and memfs already identified, versions confirmed via npm ls and official docs
- Architecture: HIGH - Existing test structure is clear, gaps are well-defined via coverage report
- Pitfalls: HIGH - ESM mocking, memfs vol.reset(), and node: protocol matching are well-documented issues
- Testing inventory: HIGH - Full function-by-function gap analysis based on source code reading and coverage report

**Research date:** 2026-02-08
**Valid until:** 2026-03-10 (30 days - stable technology stack)
