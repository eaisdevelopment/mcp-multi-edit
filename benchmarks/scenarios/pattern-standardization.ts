/**
 * Pattern standardization benchmark scenario (SCEN-04).
 *
 * Standardizes code patterns (comments, guards, formatting) across multiple
 * files to measure multi-edit efficiency for widespread small improvements.
 *
 * - Synthetic target: updates config values, log formatting, cache logic, and rate limiter guards across 4 files (18 edits)
 * - Real-world target: improves JSDoc comments and descriptions across 3 files (16 edits)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  BenchmarkScenario,
  BenchmarkTarget,
  FileEdits,
  ValidationResult,
} from '../types.js';

/**
 * Create the pattern standardization benchmark scenario.
 *
 * Returns a BenchmarkScenario that standardizes patterns across files:
 * - Synthetic: 18 edits across 4 files (config, logger, cache, rate-limiter)
 * - Real-world: 16 edits across 3 files (types, server, multi-edit tool)
 */
export function createPatternStandardizationScenario(): BenchmarkScenario {
  return {
    name: 'pattern-standardization',
    category: 'config-migration',
    description:
      'Standardize code patterns across files. Synthetic: 18 edits across 4 files (config, logger, cache, rate-limiter). Real-world: 16 edits across 3 files (types, server, multi-edit tool).',

    generateEdits(target: BenchmarkTarget): FileEdits[] {
      if (target.type === 'synthetic') {
        return generateSyntheticEdits(target);
      }
      if (target.type === 'real-world') {
        return generateRealWorldEdits(target);
      }
      return [];
    },

    async validateResults(
      target: BenchmarkTarget,
      workDir: string,
    ): Promise<ValidationResult> {
      if (target.type === 'synthetic') {
        return validateSyntheticResults(target, workDir);
      }
      if (target.type === 'real-world') {
        return validateRealWorldResults(target, workDir);
      }
      return { valid: false, errors: [`Unknown target type: ${target.type}`] };
    },
  };
}

/**
 * Generate edits for the synthetic target: standardize patterns across 4 files (18 edits).
 *
 * 1. src/config.ts: 4 edits -- update version, timeout, batch size, maxRetries
 * 2. src/utils/logger.ts: 4 edits -- improve log formatting and parsing
 * 3. src/middleware/cache.ts: 5 edits -- harden cache logic
 * 4. src/middleware/rate-limiter.ts: 5 edits -- add guards and comments
 */
function generateSyntheticEdits(target: BenchmarkTarget): FileEdits[] {
  const edits: FileEdits[] = [];

  // 1. src/config.ts -- 4 edits
  const configFile = target.files.find((f) => f.file_path === 'src/config.ts');
  if (configFile) {
    edits.push({
      file_path: configFile.file_path,
      edits: [
        {
          old_string: "export const CONFIG_VERSION = '1.0.0';",
          new_string: "export const CONFIG_VERSION = '2.0.0';",
        },
        {
          old_string: 'export const DEFAULT_TIMEOUT = 30000;',
          new_string: 'export const DEFAULT_TIMEOUT = 60000;',
        },
        {
          old_string: 'export const MAX_BATCH_SIZE = 100;',
          new_string: 'export const MAX_BATCH_SIZE = 250;',
        },
        {
          old_string: 'maxRetries: 3,',
          new_string: 'maxRetries: 5,',
        },
      ],
    });
  }

  // 2. src/utils/logger.ts -- 4 edits
  const loggerFile = target.files.find(
    (f) => f.file_path === 'src/utils/logger.ts',
  );
  if (loggerFile) {
    edits.push({
      file_path: loggerFile.file_path,
      edits: [
        {
          old_string:
            "const argsStr = args.length > 0 ? ` ${JSON.stringify(args)}` : '';",
          new_string:
            "const argsStr = args.length > 0 ? ` args=${JSON.stringify(args)}` : '';",
        },
        {
          old_string:
            'return `[${timestamp}] [${msgLevel.toUpperCase()}] [v${CONFIG_VERSION}] ${message}${argsStr}`;',
          new_string:
            'return `[${timestamp}] [${msgLevel.toUpperCase()}] [v${CONFIG_VERSION}] [pid:${process.pid}] ${message}${argsStr}`;',
        },
        {
          old_string: 'const normalized = value.toLowerCase();',
          new_string: 'const normalized = value.trim().toLowerCase();',
        },
        {
          old_string: "return 'info';",
          new_string: "return 'info'; // Default log level",
        },
      ],
    });
  }

  // 3. src/middleware/cache.ts -- 5 edits
  const cacheFile = target.files.find(
    (f) => f.file_path === 'src/middleware/cache.ts',
  );
  if (cacheFile) {
    edits.push({
      file_path: cacheFile.file_path,
      edits: [
        {
          old_string: 'if (store.size > 1000) {',
          new_string: 'if (store.size > 5000) {',
        },
        {
          old_string: "return parts.join(':');",
          new_string: "return parts.filter(Boolean).join(':');",
        },
        {
          old_string: 'return Date.now() > entry.expiresAt;',
          new_string: 'return Date.now() >= entry.expiresAt;',
        },
        {
          old_string: 'expiresAt: Date.now() + ttlMs,',
          new_string: 'expiresAt: Date.now() + Math.max(ttlMs, 0),',
        },
        {
          old_string:
            'export function createCacheKey(...parts: string[]): string {',
          new_string:
            '/** Create a cache key from parts, filtering empty segments */\nexport function createCacheKey(...parts: string[]): string {',
        },
      ],
    });
  }

  // 4. src/middleware/rate-limiter.ts -- 5 edits
  const rateLimiterFile = target.files.find(
    (f) => f.file_path === 'src/middleware/rate-limiter.ts',
  );
  if (rateLimiterFile) {
    edits.push({
      file_path: rateLimiterFile.file_path,
      edits: [
        {
          old_string:
            'const effectiveRate = Math.min(requestsPerSecond, MAX_BATCH_SIZE);',
          new_string:
            'const effectiveRate = Math.max(1, Math.min(requestsPerSecond, MAX_BATCH_SIZE));',
        },
        {
          old_string: 'const tokensNeeded = 1;',
          new_string:
            'const tokensNeeded = 1; // Always consume exactly one token per request',
        },
        {
          old_string:
            'const timePerToken = 1000 / state.requestsPerSecond;',
          new_string:
            'const timePerToken = Math.ceil(1000 / state.requestsPerSecond);',
        },
        {
          old_string: 'if (requestedRate <= 0) return 1;',
          new_string:
            'if (requestedRate <= 0) return 1; // Minimum rate is 1 request per second',
        },
        {
          old_string: 'const estimatedSeconds = batches;',
          new_string: 'const estimatedSeconds = Math.max(batches, 1);',
        },
      ],
    });
  }

  return edits;
}

/**
 * Generate edits for the real-world target: improve JSDoc and descriptions across 3 files (16 edits).
 *
 * 1. src/types/index.ts: 6 edits -- improve JSDoc comments
 * 2. src/server.ts: 5 edits -- improve version and tool descriptions
 * 3. src/tools/multi-edit.ts: 5 edits -- improve code comments
 */
function generateRealWorldEdits(target: BenchmarkTarget): FileEdits[] {
  const edits: FileEdits[] = [];

  // 1. src/types/index.ts -- 6 edits
  const typesFile = target.files.find(
    (f) => f.file_path === 'src/types/index.ts',
  );
  if (typesFile) {
    edits.push({
      file_path: typesFile.file_path,
      edits: [
        {
          old_string:
            "/** Machine-readable error code: 'RELATIVE_PATH', 'PATH_TRAVERSAL', 'FILE_NOT_FOUND', etc. */",
          new_string:
            '/** Machine-readable error code (see ErrorCode type for full list) */',
        },
        {
          old_string: '/** Human-readable message with received value */',
          new_string:
            '/** Human-readable message describing the validation failure */',
        },
        {
          old_string:
            "/** JSON path to the invalid field: ['file_path'] or ['edits', '2', 'old_string'] */",
          new_string:
            "/** JSON path to the invalid field, e.g. ['file_path'] or ['edits', '2', 'old_string'] */",
        },
        {
          old_string: '/** Actionable guidance for fixing the error */',
          new_string:
            '/** Actionable guidance for fixing the error (shown to the user) */',
        },
        {
          old_string: '/** Text to find in the file */',
          new_string:
            '/** Text to find in the file (exact match, case-sensitive by default) */',
        },
        {
          old_string: '/** Text to replace with */',
          new_string:
            '/** Replacement text (can be empty string to delete matched text) */',
        },
      ],
    });
  }

  // 2. src/server.ts -- 5 edits
  const serverFile = target.files.find(
    (f) => f.file_path === 'src/server.ts',
  );
  if (serverFile) {
    edits.push({
      file_path: serverFile.file_path,
      edits: [
        {
          old_string: "version: '0.1.0',",
          new_string: "version: '0.2.0',",
        },
        {
          old_string: "description: 'Absolute path to the file',",
          new_string:
            "description: 'Absolute path to the file (must exist and be writable)',",
        },
        {
          old_string: "description: 'Array of file edit operations',",
          new_string:
            "description: 'Array of file edit operations (each with file_path and edits)',",
        },
        {
          old_string:
            "description: 'Create .bak backup file before editing (default: true)',",
          new_string:
            "description: 'Create .bak backup before editing; restored on failure (default: true)',",
        },
        {
          old_string:
            "description: 'Preview changes without applying (default: false)',",
          new_string:
            "description: 'Preview changes without writing to disk (default: false)',",
          replace_all: true,
        },
      ],
    });
  }

  // 3. src/tools/multi-edit.ts -- 5 edits
  const multiEditFile = target.files.find(
    (f) => f.file_path === 'src/tools/multi-edit.ts',
  );
  if (multiEditFile) {
    edits.push({
      file_path: multiEditFile.file_path,
      edits: [
        {
          old_string: '* multi_edit tool handler',
          new_string:
            '* multi_edit tool handler.\n * Validates input, applies edits atomically, and formats the MCP response.',
        },
        {
          old_string:
            '* Perform multiple find-and-replace operations on a single file atomically.',
          new_string:
            '* Perform multiple find-and-replace operations on a single file atomically.\n * All edits succeed or the file remains unchanged.',
        },
        {
          old_string: '// Validate input using full layered validation',
          new_string:
            '// Validate input: schema + path + file existence + edit conflict checks',
        },
        {
          old_string:
            '// Read file content for context snippets in error responses',
          new_string:
            '// Read original content for context snippets and diff generation',
        },
        {
          old_string: '// Apply edits',
          new_string:
            '// Apply edits atomically (backup -> edit -> verify -> commit)',
        },
      ],
    });
  }

  return edits;
}

/**
 * Validate synthetic results: all pattern standardizations must be applied.
 */
async function validateSyntheticResults(
  target: BenchmarkTarget,
  workDir: string,
): Promise<ValidationResult> {
  const errors: string[] = [];

  // --- src/config.ts ---
  const configFile = target.files.find((f) => f.file_path === 'src/config.ts');
  if (configFile) {
    const content = await readFileContent(configFile.file_path, workDir, errors);
    if (content) {
      // Must contain new values
      assertContains(content, configFile.file_path, "'2.0.0'", errors);
      assertContains(content, configFile.file_path, '60000', errors);
      assertContains(content, configFile.file_path, '250', errors);
      assertContains(content, configFile.file_path, 'maxRetries: 5', errors);

      // Must NOT contain old values
      assertNotContains(content, configFile.file_path, "'1.0.0'", 'old version 1.0.0', errors);
      assertNotContains(content, configFile.file_path, '30000', 'old timeout 30000', errors);
      assertNotContains(content, configFile.file_path, 'MAX_BATCH_SIZE = 100', 'old batch size 100', errors);
      assertNotContains(content, configFile.file_path, 'maxRetries: 3', 'old maxRetries 3', errors);
    }
  } else {
    errors.push('Expected file not found in target: src/config.ts');
  }

  // --- src/utils/logger.ts ---
  const loggerFile = target.files.find(
    (f) => f.file_path === 'src/utils/logger.ts',
  );
  if (loggerFile) {
    const content = await readFileContent(loggerFile.file_path, workDir, errors);
    if (content) {
      assertContains(content, loggerFile.file_path, 'args=', errors);
      assertContains(content, loggerFile.file_path, '[pid:${process.pid}]', errors);
      assertContains(content, loggerFile.file_path, '.trim().toLowerCase()', errors);
      assertContains(content, loggerFile.file_path, '// Default log level', errors);
    }
  } else {
    errors.push('Expected file not found in target: src/utils/logger.ts');
  }

  // --- src/middleware/cache.ts ---
  const cacheFile = target.files.find(
    (f) => f.file_path === 'src/middleware/cache.ts',
  );
  if (cacheFile) {
    const content = await readFileContent(cacheFile.file_path, workDir, errors);
    if (content) {
      assertContains(content, cacheFile.file_path, '5000', errors);
      assertContains(content, cacheFile.file_path, 'filter(Boolean)', errors);
      assertContains(content, cacheFile.file_path, '>=', errors);
      assertContains(content, cacheFile.file_path, 'Math.max(ttlMs, 0)', errors);
      assertContains(content, cacheFile.file_path, 'filtering empty segments', errors);
    }
  } else {
    errors.push('Expected file not found in target: src/middleware/cache.ts');
  }

  // --- src/middleware/rate-limiter.ts ---
  const rateLimiterFile = target.files.find(
    (f) => f.file_path === 'src/middleware/rate-limiter.ts',
  );
  if (rateLimiterFile) {
    const content = await readFileContent(rateLimiterFile.file_path, workDir, errors);
    if (content) {
      assertContains(content, rateLimiterFile.file_path, 'Math.max(1,', errors);
      assertContains(content, rateLimiterFile.file_path, '// Always consume', errors);
      assertContains(content, rateLimiterFile.file_path, 'Math.ceil(1000', errors);
      assertContains(content, rateLimiterFile.file_path, '// Minimum rate', errors);
      assertContains(content, rateLimiterFile.file_path, 'Math.max(batches, 1)', errors);
    }
  } else {
    errors.push('Expected file not found in target: src/middleware/rate-limiter.ts');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate real-world results: all JSDoc and description improvements must be applied.
 */
async function validateRealWorldResults(
  target: BenchmarkTarget,
  workDir: string,
): Promise<ValidationResult> {
  const errors: string[] = [];

  // --- src/types/index.ts ---
  const typesFile = target.files.find(
    (f) => f.file_path === 'src/types/index.ts',
  );
  if (typesFile) {
    const content = await readFileContent(typesFile.file_path, workDir, errors);
    if (content) {
      assertContains(content, typesFile.file_path, '(see ErrorCode type for full list)', errors);
      assertContains(content, typesFile.file_path, 'describing the validation failure', errors);
      assertContains(content, typesFile.file_path, "e.g. ['file_path']", errors);
      assertContains(content, typesFile.file_path, '(shown to the user)', errors);
      assertContains(content, typesFile.file_path, '(exact match, case-sensitive by default)', errors);
      assertContains(content, typesFile.file_path, '(can be empty string to delete matched text)', errors);
    }
  } else {
    errors.push('Expected file not found in target: src/types/index.ts');
  }

  // --- src/server.ts ---
  const serverFile = target.files.find(
    (f) => f.file_path === 'src/server.ts',
  );
  if (serverFile) {
    const content = await readFileContent(serverFile.file_path, workDir, errors);
    if (content) {
      assertContains(content, serverFile.file_path, "'0.2.0'", errors);
      assertContains(content, serverFile.file_path, '(must exist and be writable)', errors);
      assertContains(content, serverFile.file_path, '(each with file_path and edits)', errors);
      assertContains(content, serverFile.file_path, 'restored on failure', errors);
      assertContains(content, serverFile.file_path, 'without writing to disk', errors);
    }
  } else {
    errors.push('Expected file not found in target: src/server.ts');
  }

  // --- src/tools/multi-edit.ts ---
  const multiEditFile = target.files.find(
    (f) => f.file_path === 'src/tools/multi-edit.ts',
  );
  if (multiEditFile) {
    const content = await readFileContent(multiEditFile.file_path, workDir, errors);
    if (content) {
      assertContains(content, multiEditFile.file_path, 'Validates input, applies edits atomically', errors);
      assertContains(content, multiEditFile.file_path, 'All edits succeed or the file remains unchanged', errors);
      assertContains(content, multiEditFile.file_path, 'schema + path + file existence', errors);
      assertContains(content, multiEditFile.file_path, 'Read original content for context snippets and diff generation', errors);
      assertContains(content, multiEditFile.file_path, 'Apply edits atomically (backup', errors);
    }
  } else {
    errors.push('Expected file not found in target: src/tools/multi-edit.ts');
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Read a file from the working directory, pushing an error if it fails.
 * Returns the file content, or null if the file could not be read.
 */
async function readFileContent(
  filePath: string,
  workDir: string,
  errors: string[],
): Promise<string | null> {
  const fullPath = path.join(workDir, filePath);
  try {
    return await fs.readFile(fullPath, 'utf-8');
  } catch (err) {
    errors.push(
      `Could not read ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Assert that content contains the expected value, pushing an error if not.
 */
function assertContains(
  content: string,
  filePath: string,
  expected: string,
  errors: string[],
): void {
  if (!content.includes(expected)) {
    errors.push(`${filePath}: expected '${expected}' but not found`);
  }
}

/**
 * Assert that content does NOT contain the given value, pushing an error if it does.
 */
function assertNotContains(
  content: string,
  filePath: string,
  value: string,
  label: string,
  errors: string[],
): void {
  if (content.includes(value)) {
    errors.push(`${filePath}: ${label} still present after standardization`);
  }
}
