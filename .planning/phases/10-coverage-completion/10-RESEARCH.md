# Phase 10: Coverage Completion - Research

**Researched:** 2026-02-09
**Domain:** Vitest v8 code coverage, test gap analysis, threshold enforcement
**Confidence:** HIGH

## Summary

The project currently has 159 passing tests across 8 test files, but overall line coverage stands at **79.33%** -- well below the 90% target. The gap is concentrated in a few specific areas: the entry point (`src/index.ts`, 0%), error infrastructure (`src/core/errors.ts`, 50%), reporter utilities (`src/core/reporter.ts`, 78%), and multi-file tool handler error paths (`src/tools/multi-edit-files.ts`, 62%). The good news is that the core editing engine and validator are already near or above 90%.

The path to 90% does not require architectural changes. It requires: (1) adding unit tests for currently-uncovered pure functions in `errors.ts` and `reporter.ts`, (2) adding integration tests that exercise error/rollback paths in `multi-edit-files.ts`, (3) excluding the thin entry point `index.ts` from coverage (it is a 17-line stdio bootstrap, untestable without mocking process stdio), and (4) configuring Vitest coverage thresholds to enforce the 90% floor.

**Primary recommendation:** Write targeted tests for the ~6 uncovered functions and ~10 uncovered error branches, exclude `index.ts` from coverage, and add `thresholds` to `vitest.config.ts` to enforce 90% on all four metrics.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^1.6.0 | Test runner | Already in use, project standard |
| @vitest/coverage-v8 | ^1.6.0 | V8-based coverage provider | Already installed, fast native coverage |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| memfs | ^4.56.10 | In-memory filesystem mocking | Already used for editor-io and validator-async tests |

No additional libraries needed. Everything required is already installed.

## Architecture Patterns

### Coverage Enforcement Configuration

The `vitest.config.ts` needs two additions: thresholds and an exclusion for the entry point.

```typescript
// vitest.config.ts - target configuration
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
})
```

**Source:** [Vitest coverage config reference](https://vitest.dev/config/coverage)

### Pattern: Exclude Untestable Entry Points

`src/index.ts` is a 17-line stdio bootstrap that creates a server, connects a StdioServerTransport, and logs to stderr. It cannot be meaningfully unit-tested because:
- It creates real stdio transport (stdin/stdout piping)
- It calls `main().catch(console.error)` at module top level
- The actual server logic is already tested via `createServer()` in integration tests

**Recommendation:** Add `src/index.ts` to the `exclude` list in coverage config. This is standard practice for thin entry points.

```typescript
exclude: ['node_modules/', 'dist/', 'tests/', 'src/index.ts'],
```

### Pattern: Test Pure Functions Directly

Several uncovered functions are pure (no I/O) and can be tested with simple unit tests:

| Function | File | Lines | Type |
|----------|------|-------|------|
| `classifyError()` | errors.ts | 41-78 | Pure - maps Error objects to error codes |
| `getRecoveryHints()` | errors.ts | 84-139 | Pure - switch statement returning string arrays |
| `extractFileContext()` | errors.ts | 145-193 | Pure - extracts snippet from file content |
| `extractMatchLocations()` | errors.ts | 200-237 | Pure - builds match location objects |
| `buildEditStatus()` | errors.ts | 284-311 | Pure - builds per-edit status array |
| `formatMultiEditResponse()` | reporter.ts | 184-270 | Pure - formats result into response envelope |
| `classifyErrorFromMessage()` | reporter.ts | 158-178 | Private pure - called by formatMultiEditResponse |
| `truncateForDisplay()` | reporter.ts | 148-153 | Pure - string truncation |
| `generateDiffPreview()` | reporter.ts | 276-312 | Pure - generates diff text |

### Pattern: Test Error Paths via Integration

The multi-file handler (`multi-edit-files.ts`) has many uncovered error paths (read failures, backup failures, write failures, rollback logic). These are best tested at the integration level because they involve real filesystem interactions and the rollback pipeline.

### Anti-Patterns to Avoid
- **Testing entry points with process mocking:** Mocking stdin/stdout to test `index.ts` is fragile and provides no real value -- the server creation is already tested elsewhere.
- **Increasing coverage by weakening thresholds:** Setting thresholds to 80% "to start" defeats the purpose.
- **Ignoring branch coverage:** Branch coverage at 75% means many conditional paths are untested. These are often where bugs hide.

## Current Coverage Gap Analysis

### Overall Numbers (Current)
| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Statements | 79.33% | 90% | 10.67% |
| Branches | 75.00% | 90% | 15.00% |
| Functions | 81.63% | 90% | 8.37% |
| Lines | 79.33% | 90% | 10.67% |

### Per-File Breakdown

| File | Stmts | Branch | Funcs | Lines | Status |
|------|-------|--------|-------|-------|--------|
| src/index.ts | 0% | 0% | 0% | 0% | EXCLUDE from coverage |
| src/server.ts | 94.35% | 87.5% | 100% | 94.35% | Near target - needs catch block L164-173 |
| src/core/editor.ts | 95.94% | 93.61% | 100% | 95.94% | ABOVE target |
| src/core/errors.ts | 50.16% | 35.48% | 57.14% | 50.16% | CRITICAL GAP - 3 uncovered functions |
| src/core/reporter.ts | 77.56% | 66.66% | 54.54% | 77.56% | MAJOR GAP - 5 uncovered functions |
| src/core/validator.ts | 94.63% | 84.50% | 100% | 94.63% | Near target - needs some branch coverage |
| src/tools/multi-edit.ts | 85.33% | 66.66% | 100% | 85.33% | MODERATE GAP - catch block L64-74 |
| src/tools/multi-edit-files.ts | 62.39% | 44.82% | 100% | 62.39% | CRITICAL GAP - error/rollback paths |

### Specific Uncovered Code

#### src/core/errors.ts (50.16% -> needs ~90%)
- **`classifyError()` (L41-78):** Never called from tests. Maps Error instances to error codes (ENOENT, EACCES, EPERM, ENOSPC, EROFS, ELOOP, encoding errors, unknown errors). Pure function, trivially testable.
- **`getRecoveryHints()` (L84-139):** Most switch branches uncovered (L97-137). Called indirectly via `createErrorEnvelope()` but only for a few error codes. Needs direct testing of all 18 cases.
- **`extractFileContext()` (L145-193):** Never called from tests. Extracts surrounding lines from file content near a partial match. Pure function with multiple paths (prefix matching, short strings, no-match fallback).
- **`extractMatchLocations()` (L200-237):** Never called from tests. Builds match location objects for ambiguous-match errors. Pure function.
- **`buildEditStatus()` (L284-311):** Partially covered. The function body (L303-308) for building skipped edits may be uncovered.
- **`createErrorEnvelope()` optional field branches (L267-275):** Branches for `context`, `edit_status`, `backup_path` being defined are uncovered.

#### src/core/reporter.ts (77.56% -> needs ~90%)
- **`formatMultiEditResult()` (L31-33):** Never called. Simple JSON.stringify wrapper -- likely dead code or only used externally.
- **`formatMultiEditFilesResult()` (L38-40):** Never called. Same pattern as above.
- **`createSuccessResult()` (L45-59):** Never called. Factory function that may be dead code.
- **`createErrorResult()` (L64-79):** Never called. Factory function that may be dead code.
- **`createFilesErrorResult()` (L130-143):** Never called. Factory function.
- **`formatMultiEditFilesResponse()` includeContent=true branch (L124-125):** Only the `!includeContent` path is tested.
- **`classifyErrorFromMessage()` (L158-178):** Private function. Some branches uncovered: `AMBIGUOUS_MATCH` (L164-165), `PERMISSION_DENIED` (L167-168), `INVALID_ENCODING` (L170-172), `BACKUP_FAILED` (L173-175).
- **`formatMultiEditResponse()` error path (L230-270):** Partially covered. The MATCH_NOT_FOUND context path (L239-243) and AMBIGUOUS_MATCH context path (L244-252) need error-case testing.
- **`generateDiffPreview()` no-change branch (L282-284):** The case where `originalContent === newContent`.

#### src/tools/multi-edit-files.ts (62.39% -> needs ~90%)
- **`classifyErrorCodeFromMessage()` (L32-52):** Internal helper, multiple branches uncovered (L39-51).
- **`rollbackFiles()` (L64-89):** Rollback logic -- partially exercised by the integration test for rollback, but error branch (L77-81) uncovered.
- **Read failure error path (L144-171):** When `readFileValidated` throws during multi-file processing.
- **Backup failure error path (L177-202):** When `createBackup` throws.
- **Write failure error path (L241-267):** When `atomicWrite` throws after successful in-memory edit.
- **Unexpected exception catch (L283-305):** Outer try/catch for unexpected errors.
- **`buildFileStatuses()` skipped-files branch (L351-356):** When files after the failed index need "skipped" status.

#### src/tools/multi-edit.ts (85.33% -> needs ~90%)
- **Catch block (L63-74):** The outer catch for unexpected errors thrown by `applyEdits()`.

#### src/server.ts (94.35% -> needs catch block)
- **Catch block (L164-173):** The catch handler for when `handleMultiEdit` or `handleMultiEditFiles` throw an uncaught exception. The integration test for unknown tools hits a different branch.

#### src/core/validator.ts (94.63% -> near target)
- **`validateFileExists()` EPERM and ELOOP branches (L128-148):** Only ENOENT and EACCES branches are tested.
- **`formatZodErrors()` branches (L219-234):** Some switch cases in `formatZodErrors` are not hit (invalid_type, invalid_string, default).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coverage measurement | Custom line counting | `vitest run --coverage` | V8 provider handles source maps, TypeScript, etc. |
| Threshold enforcement | CI script parsing coverage output | `coverage.thresholds` in vitest.config.ts | Built-in, fails the test run with exit code 1 |
| Coverage ignore | Custom exclude logic | `/* v8 ignore next N */` comments | Standard V8 annotation, supported by all tooling |
| Entry point exclusion | Mocking stdio | `coverage.exclude: ['src/index.ts']` | Config-level exclusion is clean and explicit |

**Key insight:** Vitest's built-in threshold enforcement makes coverage a test-run concern, not a CI-script concern. When thresholds are set, `vitest run --coverage` exits non-zero if any metric is below threshold.

## Common Pitfalls

### Pitfall 1: Testing Private Functions Indirectly
**What goes wrong:** Trying to hit coverage on private/internal functions by crafting elaborate integration test scenarios.
**Why it happens:** Functions like `classifyErrorFromMessage()` in reporter.ts are not exported.
**How to avoid:** These private functions are called by exported functions. Test the exported function (`formatMultiEditResponse`) with inputs that exercise each branch of the private function.
**Warning signs:** Convoluted test setups that need 5+ steps just to hit one branch.

### Pitfall 2: V8 Coverage Artifacts with Empty Lines
**What goes wrong:** V8 coverage sometimes marks comment lines or empty lines as uncovered.
**Why it happens:** V8 operates on compiled JavaScript, and source map translation can be imprecise.
**How to avoid:** Focus on statement and branch coverage rather than line-by-line obsession. Use `/* v8 ignore next N */` for confirmed false positives.
**Warning signs:** Coverage report shows uncovered lines that are only comments or blank lines.

### Pitfall 3: Forgetting Branch Coverage
**What goes wrong:** Reaching 90% line coverage but only 75% branch coverage.
**Why it happens:** A line with an `if` statement counts as covered if either branch is taken, but branch coverage requires BOTH branches.
**How to avoid:** Set thresholds for all four metrics (lines, functions, branches, statements), not just lines.
**Warning signs:** Branch coverage lagging 10-15% behind line coverage.

### Pitfall 4: Flaky Error Path Tests
**What goes wrong:** Tests that mock filesystem errors pass locally but fail in CI.
**Why it happens:** Different OS behaviors for permission errors, read-only filesystems, etc.
**How to avoid:** Use memfs for filesystem mocking (already established in this project). For real-filesystem error tests, use the temp directory pattern with explicit permissions.
**Warning signs:** Tests that use `chmod 000` or mock `ENOSPC`.

### Pitfall 5: Excluding Too Much Code
**What goes wrong:** Reaching 90% by adding too many `/* v8 ignore */` comments or config exclusions.
**Why it happens:** Temptation to mark hard-to-test code as "unreachable."
**How to avoid:** Only exclude genuinely untestable code (entry points with process-level I/O). Document rationale for every exclusion. Error catch blocks ARE testable.
**Warning signs:** More than 2-3 v8 ignore comments in the entire codebase.

## Code Examples

### Vitest Coverage Threshold Configuration
```typescript
// Source: https://vitest.dev/config/coverage
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/', 'src/index.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
})
```

### V8 Ignore Comments (for genuinely unreachable code)
```typescript
// Source: https://v1.vitest.dev/guide/coverage
// Use sparingly -- only for confirmed-unreachable defensive code

/* v8 ignore next 3 */
} catch {
  // Cleanup error -- temp file may not exist
}
```

### Testing Pure Error Functions
```typescript
// Pattern for testing classifyError()
import { classifyError } from '../src/core/errors.js';

describe('classifyError', () => {
  it('should classify ENOENT as FILE_NOT_FOUND', () => {
    const err = Object.assign(new Error('no such file'), { code: 'ENOENT' });
    const result = classifyError(err);
    expect(result.error_code).toBe('FILE_NOT_FOUND');
  });

  it('should classify non-Error values as UNKNOWN_ERROR', () => {
    const result = classifyError('string error', '/some/path');
    expect(result.error_code).toBe('UNKNOWN_ERROR');
    expect(result.message).toContain('/some/path');
  });
});
```

### Testing Error Paths in Tool Handlers
```typescript
// Pattern for testing the catch block in multi-edit.ts L63-74
// by providing args that pass validation but cause applyEdits to throw
import { handleMultiEdit } from '../src/tools/multi-edit.js';
import * as editor from '../src/core/editor.js';
import { vi } from 'vitest';

it('should handle unexpected applyEdits error', async () => {
  // Create a real test file that passes validation
  const filePath = await createTestFile(tempDir, 'test.txt', 'content');

  // Mock applyEdits to throw an unexpected error
  vi.spyOn(editor, 'applyEdits').mockRejectedValueOnce(new Error('unexpected'));

  const result = await handleMultiEdit({
    file_path: filePath,
    edits: [{ old_string: 'content', new_string: 'new' }],
  });

  expect(result.isError).toBe(true);
  const parsed = JSON.parse(result.content[0].text);
  expect(parsed.error_code).toBe('UNKNOWN_ERROR');
});
```

### Testing formatMultiEditResponse Error Paths
```typescript
// Pattern for testing reporter.ts error formatting with different error types
import { formatMultiEditResponse } from '../src/core/reporter.js';
import type { MultiEditResult } from '../src/types/index.js';

it('should produce AMBIGUOUS_MATCH envelope with context', () => {
  const result: MultiEditResult = {
    success: false,
    file_path: '/test.ts',
    edits_applied: 0,
    results: [{ old_string: 'foo', matches: 2, replaced: 0, success: false }],
    error: '2 matches at lines 5, 10',
    failed_edit_index: 0,
    dry_run: false,
  };
  const fileContent = 'line1\nline2\nline3\nline4\nfoo\nline6\nline7\nline8\nline9\nfoo\n';

  const response = formatMultiEditResponse(result, false, 1, fileContent, undefined, [{ old_string: 'foo' }]);

  expect(response.success).toBe(false);
  expect((response as any).error_code).toBe('AMBIGUOUS_MATCH');
  expect((response as any).context?.match_locations).toBeDefined();
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| istanbul instrumentation | V8 native coverage | Vitest 1.0+ | Faster, no code transformation needed |
| c8 ignore comments | v8 ignore comments | c8 9.2.0+ | Same syntax, `c8` still works as alias |
| CI script parsing coverage | `thresholds` in vitest.config.ts | Vitest 1.0+ | Build fails automatically below threshold |

## Estimated Effort to Reach 90%

### Work Items by Priority

1. **Exclude `src/index.ts` from coverage** -- Instantly removes the 0% file from the denominator. Impact: ~2-3% boost to overall numbers.

2. **Test `errors.ts` pure functions** (~15-20 test cases) -- `classifyError`, `getRecoveryHints`, `extractFileContext`, `extractMatchLocations`, `buildEditStatus`. These are pure functions, each test is 3-5 lines. Impact: errors.ts from 50% to 90%+.

3. **Test `reporter.ts` response formatting** (~10-15 test cases) -- `formatMultiEditResponse` error paths, `generateDiffPreview` edge cases. Exercises `classifyErrorFromMessage` indirectly. Impact: reporter.ts from 78% to 90%+.

4. **Test `multi-edit-files.ts` error/rollback paths** (~5-8 test cases) -- Read failure, backup failure, write failure, unexpected exception. These need either memfs or vi.spyOn mocking to trigger filesystem errors. Impact: multi-edit-files.ts from 62% to 85%+.

5. **Test `multi-edit.ts` catch block** (~2 test cases) -- Mock `applyEdits` to throw. Impact: multi-edit.ts from 85% to 95%+.

6. **Test `server.ts` catch block** (~1-2 test cases) -- Already near 94%, just needs the L164-173 catch exercised. Impact: server.ts to 100%.

7. **Test remaining `validator.ts` branches** (~3-5 test cases) -- EPERM, ELOOP in validateFileExists; missing formatZodErrors branches. Impact: validator.ts from 94% to 98%+.

8. **Document legitimately unreachable code** -- Any remaining gaps after testing should be documented with rationale and optionally marked with `/* v8 ignore */`.

### Dead Code Assessment

Several reporter.ts functions appear to be dead code (never called anywhere in production code):
- `formatMultiEditResult()` -- simple JSON.stringify, not used by handlers
- `formatMultiEditFilesResult()` -- simple JSON.stringify, not used by handlers
- `createSuccessResult()` -- not used; handlers build results differently
- `createErrorResult()` -- not used; handlers build results differently
- `createFilesErrorResult()` -- not used; handlers build results differently

**Options:**
1. Remove dead code (cleanest, reduces coverage denominator)
2. Test dead code anyway (maintains API surface)
3. Mark as `/* v8 ignore */` with documentation

Recommendation: Remove dead code if confirmed unused, or test it if it represents public API surface.

## Open Questions

1. **Dead code disposition**
   - What we know: 5 functions in reporter.ts appear unused by any production code path
   - What's unclear: Whether these are intended as public API for external consumers
   - Recommendation: Grep the codebase to confirm they are unused, then remove or document

2. **Per-file thresholds vs. global**
   - What we know: Vitest supports both global thresholds and per-file thresholds
   - What's unclear: Whether per-file enforcement is desired (it is stricter)
   - Recommendation: Start with global thresholds at 90%; add per-file later if needed

3. **Coverage in CI**
   - What we know: `vitest run --coverage` with thresholds will fail on low coverage
   - What's unclear: Whether CI is set up and whether `test:coverage` script should be the CI command
   - Recommendation: The `test:coverage` script already exists in package.json. Ensure CI runs this command.

## Sources

### Primary (HIGH confidence)
- [Vitest Coverage Config Reference](https://vitest.dev/config/coverage) - Thresholds, exclude, providers
- [Vitest v1.6 Coverage Guide](https://v1.vitest.dev/guide/coverage) - v8 ignore comments, setup
- Local codebase analysis - Direct examination of all source files and coverage output

### Secondary (MEDIUM confidence)
- [V8 Coverage Ignore Comments blog post](https://electrovir.com/2024-08-17-node-coverage-comments/) - v8 ignore syntax variations
- [c8 README](https://github.com/bcoe/c8/blob/main/README.md) - v8 ignore next, start/stop syntax

## Metadata

**Confidence breakdown:**
- Coverage gap analysis: HIGH - Based on actual `vitest run --coverage` output and JSON analysis of coverage-final.json
- Vitest threshold config: HIGH - Official docs verified
- V8 ignore syntax: HIGH - Verified across multiple sources
- Dead code assessment: MEDIUM - Based on grep of codebase, but external consumers could exist
- Effort estimates: MEDIUM - Based on analysis of uncovered lines, but actual test complexity may vary

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (stable project, no upstream changes expected)
