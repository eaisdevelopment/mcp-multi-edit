# Testing Patterns

**Analysis Date:** 2026-02-05

## Test Framework

**Runner:**
- Vitest 1.6.0
- Config: `vitest.config.ts`
- Node.js version requirement: 20.0.0+

**Assertion Library:**
- Vitest built-in assertions via `expect()`

**Run Commands:**
```bash
npm test              # Run all tests once
npm run test:watch   # Watch mode with auto-rerun
npm run test:coverage # Run with coverage report
```

## Test File Organization

**Location:**
- Separate test directory structure: `tests/` at project root
- NOT co-located with source files

**Naming:**
- Unit tests: `{module}.test.ts`
- Integration tests: `{module}.test.ts` (same naming, different directory)
- Example files:
  - `tests/unit/editor.test.ts`
  - `tests/unit/validator.test.ts`
  - `tests/integration/server.test.ts`

**Structure:**
```
tests/
├── unit/
│   ├── editor.test.ts          # Tests for src/core/editor.ts
│   └── validator.test.ts       # Tests for src/core/validator.ts
├── integration/
│   └── server.test.ts          # Integration tests for MCP server
└── fixtures/
    └── sample-files/
        └── example.ts          # Sample file for testing
```

## Test Structure

**Suite Organization:**

All tests follow the Vitest describe/it pattern from `tests/unit/validator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('validateMultiEditInput', () => {
  it('should validate correct input', () => {
    const input = {
      file_path: '/path/to/file.ts',
      edits: [{ old_string: 'foo', new_string: 'bar' }],
    };
    const result = validateMultiEditInput(input);
    expect(result.success).toBe(true);
  });

  it('should reject empty file_path', () => {
    const input = {
      file_path: '',
      edits: [{ old_string: 'foo', new_string: 'bar' }],
    };
    const result = validateMultiEditInput(input);
    expect(result.success).toBe(false);
  });
});
```

**Patterns:**
- One `describe()` block per function being tested
- Multiple `it()` test cases within each describe block
- Descriptive test names using "should" pattern: `it('should validate correct input', ...)`
- Clear arrange-act-assert flow: setup data → call function → assert result
- No setup/teardown (beforeEach/afterEach) used in existing tests
- Setup with `beforeAll`/`afterAll` stub in integration tests: `beforeAll`, `afterAll` imported but not used

## Mocking

**Framework:** None configured
- No mock library in package.json (vitest has built-in mocking)
- Current tests use real functions, not mocked

**Patterns:**
- Tests directly call functions with test data
- No mock setup observed in existing tests
- File system operations not tested yet (see `applyEdits()` TODO in `tests/unit/editor.test.ts` line 79)

**What to Mock (Future):**
- File system operations (`fs/promises` in `src/core/editor.ts`)
- MCP server requests/responses
- Network calls (if added)

**What NOT to Mock:**
- Pure functions like `replaceString()`, `findOccurrences()`
- Validation functions that don't have side effects
- Type definitions

## Fixtures and Factories

**Test Data:**

Inline test data objects used throughout. Example from `tests/unit/validator.test.ts`:

```typescript
it('should validate correct input', () => {
  const input = {
    file_path: '/path/to/file.ts',
    edits: [{ old_string: 'foo', new_string: 'bar' }],
  };
  const result = validateMultiEditInput(input);
  expect(result.success).toBe(true);
});
```

**Location:**
- `tests/fixtures/sample-files/` contains example files for testing
- `tests/fixtures/sample-files/example.ts` - Sample TypeScript file with test content

**Structure of Example File:**
```typescript
// Sample file for testing multi-edit operations

const foo = 'hello';
const bar = 'world';

function oldFunction() {
  console.log(foo, bar);
}

// TODO: This is a test
// TODO: Another test
// TODO: Third test

export { foo, bar, oldFunction };
```

## Coverage

**Requirements:** 90%+ coverage target (from CLAUDE.md)

**View Coverage:**
```bash
npm run test:coverage
```

**Coverage Configuration (vitest.config.ts):**
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  exclude: ['node_modules/', 'dist/', 'tests/']
}
```

- Reporters: text (console), JSON, HTML
- V8 provider for coverage metrics
- Tests directory excluded from coverage (test files themselves not counted)

## Test Types

**Unit Tests:**
- Location: `tests/unit/`
- Scope: Individual functions in isolation
- Examples:
  - `editor.test.ts` - Tests `findOccurrences()` and `replaceString()`
  - `validator.test.ts` - Tests validation schemas and helper functions
- No file I/O or external dependencies
- All 37 test cases execute in unit tests

**Integration Tests:**
- Location: `tests/integration/`
- Scope: Full MCP server with client connections (TODO)
- Currently contains skeleton with `.todo()` placeholders
- Planned test cases from `tests/integration/server.test.ts` lines 11-27:
  - Tool listing
  - Single and multiple edits
  - Atomic rollback on failure
  - Dry run mode
  - Backup file creation
  - Error handling (non-existent files, permissions)

**E2E Tests:**
- Not implemented
- Would test CLI invocation via `npm run dev`

## Common Patterns

**Async Testing:**

Pattern for async functions (not yet implemented for `applyEdits`):

```typescript
describe('applyEdits', () => {
  it('should apply edits asynchronously', async () => {
    const result = await applyEdits(
      '/path/to/file.ts',
      [{ old_string: 'foo', new_string: 'bar' }]
    );
    expect(result.success).toBe(true);
  });
});
```

**Error Testing:**

Pattern from `tests/unit/validator.test.ts` line 25-31:

```typescript
it('should reject empty file_path', () => {
  const input = {
    file_path: '',
    edits: [{ old_string: 'foo', new_string: 'bar' }],
  };
  const result = validateMultiEditInput(input);
  expect(result.success).toBe(false);
});
```

Error results are checked via `.success` property, not exception throwing.

**Default Values Testing:**

Pattern from `tests/unit/validator.test.ts` line 61-73:

```typescript
it('should set default values', () => {
  const input = {
    file_path: '/path/to/file.ts',
    edits: [{ old_string: 'foo', new_string: 'bar' }],
  };
  const result = validateMultiEditInput(input);
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.dry_run).toBe(false);
    expect(result.data.create_backup).toBe(false);
    expect(result.data.edits[0].replace_all).toBe(false);
  }
});
```

## Test Organization by Module

**editor.test.ts (8 test cases):**
- `findOccurrences()` - 4 tests covering single, multiple, zero occurrences, empty string
- `replaceString()` - 6 tests covering single replace, replace all, no match, empty strings, multiline

**validator.test.ts (13 test cases):**
- `validateMultiEditInput()` - 6 tests (valid input, empty paths/edits, empty old_string, empty new_string, defaults)
- `validateMultiEditFilesInput()` - 2 tests (valid multi-file, empty array rejection)
- `isAbsolutePath()` - 2 tests (absolute vs relative paths)
- `detectOverlappingEdits()` - 3 tests (overlapping detection, non-overlapping)

**server.test.ts (0 implemented, 8 planned):**
- Skeleton with `.todo()` placeholder tests
- Not yet implemented waiting for handler functions

## Test Execution Flow

**Current State:**
- Unit tests can run with `npm test`
- Integration tests placeholder (no-op with `.todo()`)
- Tests follow TDD pattern from CLAUDE.md (tests before implementation)

**Future Implementation Order (per CLAUDE.md):**
1. Complete unit tests for `applyEdits()` with file operations
2. Implement integration tests with MCP client
3. Add E2E tests with server startup

---

*Testing analysis: 2026-02-05*
