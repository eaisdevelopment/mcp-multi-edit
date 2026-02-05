# Phase 1: Core Editor Engine - Research

**Researched:** 2026-02-05
**Domain:** File editing with atomic operations, string replacement, UTF-8 handling
**Confidence:** HIGH

## Summary

This phase implements the core `applyEdits` function for atomic multi-edit operations on a single file. The research confirms that Node.js provides all necessary primitives via `fs/promises` for atomic file writes using the temp-file-then-rename pattern. The existing project scaffolding already includes working utility functions (`findOccurrences`, `replaceString`) and Zod validation schemas.

The key implementation challenges are:
1. Sequential edit simulation for upfront validation (to guarantee atomicity)
2. Line number calculation for error reporting on non-unique matches
3. Case-insensitive matching support per the CONTEXT.md decisions
4. Atomic write via temp file + rename

**Primary recommendation:** Implement sequential simulation that validates all edits against progressively modified content before touching disk. Use native `fs.promises.writeFile` to temp file then `fs.promises.rename` for atomicity - no external libraries needed.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs/promises` | Built-in (20+) | Async file operations | Native, no dependencies, full feature set |
| Node.js `path` | Built-in | Path manipulation | Native, cross-platform path handling |
| Node.js `os` | Built-in | Temp directory location | Native `os.tmpdir()` for temp file placement |
| Node.js `crypto` | Built-in | Random temp file suffix | Native `crypto.randomBytes()` for uniqueness |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 3.23+ | Input validation | Already in project - use existing schemas |
| memfs | Latest | Test mocking | For unit tests that need isolated file system |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native fs + rename | write-file-atomic (npm) | write-file-atomic handles more edge cases (Windows, permissions) but adds dependency; native is sufficient for this use case |
| String indexOf | RegExp for case-insensitive | RegExp needed for case_insensitive flag; indexOf for default case-sensitive |

**Installation:**
```bash
# Already installed - no new dependencies needed for core editor
npm install  # existing deps sufficient
# For tests only:
npm install -D memfs
```

## Architecture Patterns

### Recommended Project Structure
```
src/core/
  editor.ts        # applyEdits function (main implementation)
  validator.ts     # Zod schemas (already exists)
  reporter.ts      # Result formatting (already exists)
```

### Pattern 1: Sequential Simulation for Atomic Validation

**What:** Validate all edits against progressively simulated content before writing anything to disk.

**When to use:** Always - this is the core pattern for guaranteeing atomicity.

**Why:** If validation passes, we know the entire operation will succeed. No partial file states possible.

**Example:**
```typescript
// Source: Derived from CONTEXT.md decisions
async function applyEdits(filePath: string, edits: EditOperation[]): Promise<MultiEditResult> {
  // 1. Read original content
  const originalContent = await fs.readFile(filePath, 'utf8');

  // 2. Simulate all edits sequentially (validate upfront)
  let simulatedContent = originalContent;
  const results: EditResult[] = [];

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    const validation = validateEdit(simulatedContent, edit, i, edits.length);

    if (!validation.success) {
      // Return immediately on first failure
      return createErrorResult(filePath, validation.error, i, results);
    }

    // Apply edit to simulation
    simulatedContent = applyEditToContent(simulatedContent, edit);
    results.push(validation.result);
  }

  // 3. All validations passed - write atomically
  await atomicWrite(filePath, simulatedContent);

  return createSuccessResult(filePath, results, false);
}
```

### Pattern 2: Atomic Write via Temp-Then-Rename

**What:** Write to temporary file, then rename to target (atomic on POSIX).

**When to use:** Any file write that must not leave partial content.

**Example:**
```typescript
// Source: Node.js fs documentation, write-file-atomic pattern
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

async function atomicWrite(filePath: string, content: string): Promise<void> {
  // Generate unique temp file in same directory (same filesystem for rename)
  const dir = path.dirname(filePath);
  const tempSuffix = crypto.randomBytes(6).toString('hex');
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${tempSuffix}.tmp`);

  try {
    // Write to temp file
    await fs.writeFile(tempPath, content, 'utf8');

    // Atomic rename
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on failure
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}
```

### Pattern 3: Line Number Calculation for Error Messages

**What:** Convert character index to line number for error reporting.

**When to use:** When reporting non-unique match positions per CONTEXT.md decision.

**Example:**
```typescript
// Source: Standard string manipulation
function getLineNumber(content: string, charIndex: number): number {
  // Count newlines before the character index
  const beforeMatch = content.substring(0, charIndex);
  return beforeMatch.split('\n').length;
}

function findAllMatchPositions(content: string, searchString: string): number[] {
  const positions: number[] = [];
  let pos = 0;
  while ((pos = content.indexOf(searchString, pos)) !== -1) {
    positions.push(pos);
    pos += searchString.length;
  }
  return positions;
}

function getMatchLineNumbers(content: string, searchString: string): number[] {
  return findAllMatchPositions(content, searchString).map(pos => getLineNumber(content, pos));
}
```

### Pattern 4: Case-Insensitive Search

**What:** Support optional case_insensitive flag per edit.

**When to use:** When edit has `case_insensitive: true`.

**Example:**
```typescript
// Source: JavaScript string methods
function findOccurrencesCaseInsensitive(
  content: string,
  searchString: string,
  caseInsensitive: boolean
): number {
  if (caseInsensitive) {
    // Use lowercase comparison
    const lowerContent = content.toLowerCase();
    const lowerSearch = searchString.toLowerCase();
    return findOccurrences(lowerContent, lowerSearch);
  }
  return findOccurrences(content, searchString);
}

function replaceStringCaseInsensitive(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean,
  caseInsensitive: boolean
): { content: string; replacedCount: number } {
  if (caseInsensitive) {
    // Build regex with 'i' flag
    const escapedOld = escapeRegExp(oldString);
    const flags = replaceAll ? 'gi' : 'i';
    const regex = new RegExp(escapedOld, flags);

    // Count matches first
    const matchCount = (content.match(new RegExp(escapedOld, 'gi')) || []).length;
    const replaceCount = replaceAll ? matchCount : (matchCount > 0 ? 1 : 0);

    const newContent = content.replace(regex, newString);
    return { content: newContent, replacedCount: replaceCount };
  }
  return replaceString(content, oldString, newString, replaceAll);
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### Anti-Patterns to Avoid
- **Reading file multiple times:** Read once, simulate in memory, write once
- **Writing directly to target file:** Always use temp file + rename for atomicity
- **Throwing on first validation error:** Return structured error result instead
- **Using sync file operations:** Use async `fs/promises` throughout
- **Catching errors silently:** Always include recovery hints in error messages

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Input validation | Custom type checks | Zod schemas (already in project) | Type inference, clear errors, battle-tested |
| Regex escaping | Manual character escaping | `escapeRegExp` function | Edge cases with special chars |
| UTF-8 validation | Manual byte checking | `buffer.isUtf8()` | Node.js built-in, handles all edge cases |
| Path handling | String concatenation | `path.join`, `path.dirname` | Cross-platform, handles edge cases |

**Key insight:** The existing project already has type definitions, Zod schemas, and utility functions. Don't recreate - extend what exists.

## Common Pitfalls

### Pitfall 1: Temp File on Different Filesystem
**What goes wrong:** `fs.rename()` fails across filesystem boundaries.
**Why it happens:** Temp file created in `/tmp` but target in different mount.
**How to avoid:** Create temp file in same directory as target file.
**Warning signs:** `EXDEV` error on rename.

### Pitfall 2: Non-Unique Match Not Caught
**What goes wrong:** Edit replaces wrong occurrence when multiple exist.
**Why it happens:** Not checking occurrence count before replace.
**How to avoid:** Always count matches first, error if count > 1 and replace_all=false.
**Warning signs:** Unexpected file content after edit.

### Pitfall 3: Sequential Simulation State Leak
**What goes wrong:** Simulation modifies original content variable.
**Why it happens:** String immutability misunderstanding or mutable reference.
**How to avoid:** JavaScript strings are immutable - just reassign; be careful with any intermediate data structures.
**Warning signs:** Multiple runs produce different results.

### Pitfall 4: Invalid UTF-8 Crashes
**What goes wrong:** `fs.readFile` with 'utf8' throws on invalid encoding.
**Why it happens:** Binary files or corrupted text files.
**How to avoid:** Wrap in try-catch, provide clear error: "File contains invalid UTF-8 encoding".
**Warning signs:** `ERR_INVALID_CHAR` or garbled output.

### Pitfall 5: Empty String Match
**What goes wrong:** Empty `old_string` causes infinite loop or unexpected behavior.
**Why it happens:** `indexOf('')` returns 0, causes infinite loop in find-all.
**How to avoid:** Reject empty old_string in validation (Zod schema already does this).
**Warning signs:** Hang or OOM on edit operation.

### Pitfall 6: Temp File Left Behind
**What goes wrong:** Temp files accumulate on errors.
**Why it happens:** Error thrown before cleanup code runs.
**How to avoid:** Use try-finally pattern for temp file cleanup.
**Warning signs:** `.tmp` files in directories after failures.

## Code Examples

Verified patterns from official sources:

### Read File with UTF-8 Validation
```typescript
// Source: Node.js fs documentation
import * as fs from 'fs/promises';
import { isUtf8 } from 'buffer';

async function readFileValidated(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);

  if (!isUtf8(buffer)) {
    throw new Error(`File contains invalid UTF-8 encoding: ${filePath}. Ensure the file is UTF-8 encoded.`);
  }

  return buffer.toString('utf8');
}
```

### Validate Edit Operation
```typescript
// Source: Derived from CONTEXT.md decisions
interface EditValidation {
  success: boolean;
  error?: string;
  result?: EditResult;
}

function validateEdit(
  content: string,
  edit: EditOperation,
  editIndex: number,
  totalEdits: number
): EditValidation {
  const { old_string, new_string, replace_all = false, case_insensitive = false } = edit;

  // Allow no-op edits (old_string === new_string)
  if (old_string === new_string) {
    return {
      success: true,
      result: { old_string, matches: 0, replaced: 0, success: true }
    };
  }

  // Count occurrences
  const occurrences = case_insensitive
    ? findOccurrencesCaseInsensitive(content, old_string)
    : findOccurrences(content, old_string);

  // Zero matches is always an error
  if (occurrences === 0) {
    const suggestion = suggestSimilar(content, old_string);
    return {
      success: false,
      error: `Edit ${editIndex + 1} of ${totalEdits} failed: String not found: "${truncate(old_string, 50)}". ${suggestion}`
    };
  }

  // Non-unique match without replace_all
  if (occurrences > 1 && !replace_all) {
    const lineNumbers = getMatchLineNumbers(content, old_string, case_insensitive);
    return {
      success: false,
      error: `Edit ${editIndex + 1} of ${totalEdits} failed: Found ${occurrences} matches at lines ${lineNumbers.join(', ')}. Use replace_all: true to replace all occurrences.`
    };
  }

  return {
    success: true,
    result: {
      old_string,
      matches: occurrences,
      replaced: replace_all ? occurrences : 1,
      success: true
    }
  };
}
```

### Complete applyEdits Implementation Structure
```typescript
// Source: Integration of all patterns
export async function applyEdits(
  filePath: string,
  edits: EditOperation[],
  dryRun: boolean = false,
  createBackup: boolean = false
): Promise<MultiEditResult> {
  // 1. Handle empty edits array
  if (edits.length === 0) {
    return createSuccessResult(filePath, [], dryRun);
  }

  // 2. Read and validate file
  let originalContent: string;
  try {
    originalContent = await readFileValidated(filePath);
  } catch (error) {
    return createErrorResult(
      filePath,
      formatFileError(error, filePath),
      undefined,
      []
    );
  }

  // 3. Sequential simulation (validate all edits)
  let simulatedContent = originalContent;
  const results: EditResult[] = [];

  for (let i = 0; i < edits.length; i++) {
    const validation = validateEdit(simulatedContent, edits[i], i, edits.length);

    if (!validation.success) {
      return createErrorResult(filePath, validation.error!, i, results);
    }

    // Apply edit to simulation for next iteration
    const { content: newContent } = applyEditToContent(simulatedContent, edits[i]);
    simulatedContent = newContent;
    results.push(validation.result!);
  }

  // 4. All validations passed
  if (dryRun) {
    return createSuccessResult(filePath, results, true);
  }

  // 5. Create backup if requested
  let backupPath: string | undefined;
  if (createBackup) {
    backupPath = `${filePath}.bak`;
    await fs.copyFile(filePath, backupPath);
  }

  // 6. Atomic write
  try {
    await atomicWrite(filePath, simulatedContent);
  } catch (error) {
    return createErrorResult(
      filePath,
      formatFileError(error, filePath),
      undefined,
      results
    );
  }

  return createSuccessResult(filePath, results, false, backupPath);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| fs.writeFileSync | fs/promises.writeFile | Node.js 10+ | Non-blocking, better for servers |
| Manual callbacks | async/await with fs/promises | Node.js 14+ | Cleaner code, better error handling |
| External atomic-write libs | Native temp+rename | Always valid | Fewer dependencies, same guarantees |

**Deprecated/outdated:**
- `fs.exists()`: Deprecated, use `fs.access()` or catch ENOENT from read
- Callback-style fs methods: Use `fs/promises` for async/await

## Open Questions

Things that couldn't be fully resolved:

1. **Windows atomicity of rename**
   - What we know: `fs.rename()` is atomic on POSIX systems
   - What's unclear: Windows behavior may differ in edge cases (file in use, permissions)
   - Recommendation: Document as "atomic on POSIX; best-effort on Windows" - acceptable for this use case

2. **Performance with very large files**
   - What we know: Reading entire file into memory is necessary for string operations
   - What's unclear: At what file size does this become problematic?
   - Recommendation: Accept current approach; add size limit warning in future if needed

## Sources

### Primary (HIGH confidence)
- `/websites/nodejs_api` (Context7) - fs/promises, writeFile, rename, Buffer.isUtf8
- `/vitest-dev/vitest` (Context7) - memfs mocking pattern for tests
- `/websites/v3_zod_dev` (Context7) - safeParse, custom error messages

### Secondary (MEDIUM confidence)
- [write-file-atomic GitHub](https://github.com/npm/write-file-atomic) - Atomic write patterns, temp file naming conventions
- [Node.js official documentation](https://nodejs.org/api/fs.html) - File system operations

### Tertiary (LOW confidence)
- Web search results for case-insensitive patterns - Multiple sources agree on toLowerCase() approach

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using only Node.js built-ins, well-documented
- Architecture: HIGH - Sequential simulation pattern is established, CONTEXT.md provides clear decisions
- Pitfalls: HIGH - Common issues are well-documented in Node.js ecosystem

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (stable domain, 30 days validity)
