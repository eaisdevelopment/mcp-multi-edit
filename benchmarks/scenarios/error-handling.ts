/**
 * Error handling enhancement benchmark scenario (SCEN-04).
 *
 * Enhances error messages with severity prefixes and error codes across
 * multiple files to measure multi-edit efficiency for cross-cutting
 * error handling improvements.
 *
 * - Synthetic target: adds error codes to plugins, severity prefixes to handlers (4 files, 20 edits)
 * - Real-world target: enhances recovery hints, error classification, and tool descriptions (3 files, 15 edits)
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
 * Create the error handling enhancement benchmark scenario.
 *
 * Returns a BenchmarkScenario that enhances error handling across files:
 * - Synthetic: adds error code prefixes to plugin messages, severity tags to handler messages (4 files, 20 edits)
 * - Real-world: adds recovery hints, expands error classification, improves tool descriptions (3 files, 15 edits)
 */
export function createErrorHandlingScenario(): BenchmarkScenario {
  return {
    name: 'error-handling-enhancement',
    category: 'refactor',
    description:
      'Enhance error handling across multiple files. Synthetic: add error code prefixes and severity tags (4 files, 20 edits). Real-world: expand recovery hints, error classification, and tool descriptions (3 files, 15 edits).',

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
 * Generate edits for the synthetic target: enhance error handling across 4 files (20 edits).
 *
 * 1. src/plugins/csv-plugin.ts (5 edits): error code prefix, errorCode metadata, input type, empty return, version bump
 * 2. src/plugins/json-plugin.ts (5 edits): error code prefix + errorCode metadata (combined), input error, fallback return, version bump
 * 3. src/handlers/error-handler.ts (5 edits): add [ERROR] prefix to all error messages
 * 4. src/handlers/input-handler.ts (5 edits): add severity prefixes [WARN], [ERROR], [INFO] to log messages
 */
function generateSyntheticEdits(target: BenchmarkTarget): FileEdits[] {
  const edits: FileEdits[] = [];

  // 1. src/plugins/csv-plugin.ts -- 5 edits
  const csvPluginFile = target.files.find(
    (f) => f.file_path === 'src/plugins/csv-plugin.ts',
  );
  if (csvPluginFile) {
    edits.push({
      file_path: csvPluginFile.file_path,
      edits: [
        // Edits 1+2 combined: Add error code prefix AND errorCode metadata in catch block
        // Combined to disambiguate from the success metadata block (both contain `metadata: { plugin: this.name, version: this.version },`)
        {
          old_string:
            'errors: [\n' +
            '          `CSV processing failed: ${error instanceof Error ? error.message : String(error)}`,\n' +
            '        ],\n' +
            '        metadata: { plugin: this.name, version: this.version },',
          new_string:
            'errors: [\n' +
            '          `[CSV_PROCESSING_ERROR] CSV processing failed: ${error instanceof Error ? error.message : String(error)}`,\n' +
            '        ],\n' +
            "        metadata: { plugin: this.name, version: this.version, errorCode: 'CSV_PROCESSING_ERROR' },",
        },
        // Edit 3: Expand input type error message
        {
          old_string: "'CSV input must be a string'",
          new_string: "'CSV input must be a string or Buffer'",
        },
        // Edit 4: Add empty flag to empty return
        {
          old_string: 'return { headers: [], rows: [] };',
          new_string: 'return { headers: [], rows: [], empty: true };',
        },
        // Edit 5: Bump version
        {
          old_string: "readonly version = '1.0.0';",
          new_string: "readonly version = '1.1.0';",
        },
      ],
    });
  }

  // 2. src/plugins/json-plugin.ts -- 5 edits
  // Edits 1+2 are combined into a single edit for disambiguation (errors array + metadata in catch block)
  const jsonPluginFile = target.files.find(
    (f) => f.file_path === 'src/plugins/json-plugin.ts',
  );
  if (jsonPluginFile) {
    edits.push({
      file_path: jsonPluginFile.file_path,
      edits: [
        // Edits 1+2 combined: Add error code prefix AND errorCode metadata in catch block
        {
          old_string:
            'errors: [\n' +
            '          `JSON processing failed: ${error instanceof Error ? error.message : String(error)}`,\n' +
            '        ],\n' +
            '        metadata: { plugin: this.name, version: this.version },',
          new_string:
            'errors: [\n' +
            '          `[JSON_PROCESSING_ERROR] JSON processing failed: ${error instanceof Error ? error.message : String(error)}`,\n' +
            '        ],\n' +
            "        metadata: { plugin: this.name, version: this.version, errorCode: 'JSON_PROCESSING_ERROR' },",
        },
        // Edit 3: Expand JSON input error message
        {
          old_string: "'Invalid JSON string provided'",
          new_string: "'Invalid JSON string provided (parse error)'",
        },
        // Edit 4: Add _type to fallback return (the last `return { value: input };`)
        {
          old_string: 'return { value: input };',
          new_string: 'return { value: input, _type: typeof input };',
        },
        // Edit 5: Bump version
        {
          old_string: "readonly version = '1.0.0';",
          new_string: "readonly version = '1.1.0';",
        },
      ],
    });
  }

  // 3. src/handlers/error-handler.ts -- 5 edits: add [ERROR] prefix to all messages
  const errorHandlerFile = target.files.find(
    (f) => f.file_path === 'src/handlers/error-handler.ts',
  );
  if (errorHandlerFile) {
    edits.push({
      file_path: errorHandlerFile.file_path,
      edits: [
        // Edit 1: Processing failed message
        {
          old_string:
            '`Processing failed [${error.errorCode}]: ${error.message}`',
          new_string:
            '`[ERROR] Processing failed [${error.errorCode}]: ${error.message}`',
        },
        // Edit 2: Validation failed message
        {
          old_string:
            '`Validation failed [${error.errorCode}]: ${error.message}${fieldInfo}`',
          new_string:
            '`[ERROR] Validation failed [${error.errorCode}]: ${error.message}${fieldInfo}`',
        },
        // Edit 3: Plugin failed message
        {
          old_string:
            '`Plugin "${error.pluginName}" failed [${error.errorCode}]: ${error.message}`',
          new_string:
            '`[ERROR] Plugin "${error.pluginName}" failed [${error.errorCode}]: ${error.message}`',
        },
        // Edit 4: Unexpected error message
        {
          old_string: '`Unexpected error: ${error.message}`',
          new_string: '`[ERROR] Unexpected error: ${error.message}`',
        },
        // Edit 5: createErrorResult message
        {
          old_string: '`[${code}] ${message}`',
          new_string: '`[ERROR] [${code}] ${message}`',
        },
      ],
    });
  }

  // 4. src/handlers/input-handler.ts -- 5 edits: add severity prefixes
  const inputHandlerFile = target.files.find(
    (f) => f.file_path === 'src/handlers/input-handler.ts',
  );
  if (inputHandlerFile) {
    edits.push({
      file_path: inputHandlerFile.file_path,
      edits: [
        // Edit 1: Empty input -> [WARN]
        {
          old_string: '`[${requestId}] Empty input received`',
          new_string: '`[WARN] [${requestId}] Empty input received`',
        },
        // Edit 2: Timeout -> [ERROR]
        {
          old_string:
            '`[${requestId}] Processing timed out after ${timeout}ms`',
          new_string:
            '`[ERROR] [${requestId}] Processing timed out after ${timeout}ms`',
        },
        // Edit 3: Success -> [INFO]
        {
          old_string:
            '`[${requestId}] Processed successfully in ${duration}ms`',
          new_string:
            '`[INFO] [${requestId}] Processed successfully in ${duration}ms`',
        },
        // Edit 4: Processing failed -> [ERROR]
        {
          old_string:
            "`[${requestId}] Processing failed: ${result.errors.join(', ')}`",
          new_string:
            "`[ERROR] [${requestId}] Processing failed: ${result.errors.join(', ')}`",
        },
        // Edit 5: Unexpected error -> [ERROR]
        {
          old_string:
            '`[${requestId}] Unexpected error: ${error instanceof Error ? error.message : String(error)}`',
          new_string:
            '`[ERROR] [${requestId}] Unexpected error: ${error instanceof Error ? error.message : String(error)}`',
        },
      ],
    });
  }

  return edits;
}

/**
 * Generate edits for the real-world target: enhance error handling across 3 files (15 edits).
 *
 * 1. src/core/errors.ts (5 edits): add recovery hints to existing error codes
 * 2. src/core/reporter.ts (5 edits): expand error classification patterns
 * 3. src/server.ts (5 edits): improve tool description strings
 */
function generateRealWorldEdits(target: BenchmarkTarget): FileEdits[] {
  const edits: FileEdits[] = [];

  // 1. src/core/errors.ts -- 5 edits: add additional recovery hints
  const errorsFile = target.files.find(
    (f) => f.file_path === 'src/core/errors.ts',
  );
  if (errorsFile) {
    edits.push({
      file_path: errorsFile.file_path,
      edits: [
        // Edit 1: Add hint to MATCH_NOT_FOUND
        {
          old_string:
            "'Check for whitespace differences between old_string and file content',\n" +
            "        'Re-read the file to see its current content before retrying',\n" +
            '      ];',
          new_string:
            "'Check for whitespace differences between old_string and file content',\n" +
            "        'Re-read the file to see its current content before retrying',\n" +
            "        'Consider using a shorter, more unique substring',\n" +
            '      ];',
        },
        // Edit 2: Add hint to AMBIGUOUS_MATCH
        {
          old_string:
            "'Use replace_all: true to replace all occurrences',\n" +
            "        'Make old_string more specific to match only the intended location',\n" +
            '      ];',
          new_string:
            "'Use replace_all: true to replace all occurrences',\n" +
            "        'Make old_string more specific to match only the intended location',\n" +
            "        'Include surrounding context to disambiguate',\n" +
            '      ];',
        },
        // Edit 3: Add hint to FILE_NOT_FOUND
        {
          old_string:
            "return ['Check that the file path is correct and the file exists'];",
          new_string:
            "return ['Check that the file path is correct and the file exists', 'Verify the working directory is correct'];",
        },
        // Edit 4: Add hint to PERMISSION_DENIED
        {
          old_string:
            "return ['Check file permissions or run with appropriate access'];",
          new_string:
            "return ['Check file permissions or run with appropriate access', 'Verify file ownership with ls -la'];",
        },
        // Edit 5: Add hint to VALIDATION_FAILED
        {
          old_string:
            "return ['Check input format matches the tool schema'];",
          new_string:
            "return ['Check input format matches the tool schema', 'Review the tool documentation for expected input shape'];",
        },
      ],
    });
  }

  // 2. src/core/reporter.ts -- 5 edits: expand error classification patterns
  const reporterFile = target.files.find(
    (f) => f.file_path === 'src/core/reporter.ts',
  );
  if (reporterFile) {
    edits.push({
      file_path: reporterFile.file_path,
      edits: [
        // Edit 1: Expand MATCH_NOT_FOUND pattern
        {
          old_string:
            "if (lower.includes('not found')) {\n" +
            "    return 'MATCH_NOT_FOUND';\n" +
            '  }',
          new_string:
            "if (lower.includes('not found') || lower.includes('no match')) {\n" +
            "    return 'MATCH_NOT_FOUND';\n" +
            '  }',
        },
        // Edit 2: Expand AMBIGUOUS_MATCH pattern
        {
          old_string:
            "if (lower.includes('matches at lines') || lower.includes('occurrences found')) {\n" +
            "    return 'AMBIGUOUS_MATCH';\n" +
            '  }',
          new_string:
            "if (lower.includes('matches at lines') || lower.includes('occurrences found') || lower.includes('multiple matches')) {\n" +
            "    return 'AMBIGUOUS_MATCH';\n" +
            '  }',
        },
        // Edit 3: Expand PERMISSION_DENIED pattern
        {
          old_string:
            "if (lower.includes('permission denied') || lower.includes('eacces')) {\n" +
            "    return 'PERMISSION_DENIED';\n" +
            '  }',
          new_string:
            "if (lower.includes('permission denied') || lower.includes('eacces') || lower.includes('eperm')) {\n" +
            "    return 'PERMISSION_DENIED';\n" +
            '  }',
        },
        // Edit 4: Expand BACKUP_FAILED pattern
        {
          old_string:
            "if (lower.includes('backup failed')) {\n" +
            "    return 'BACKUP_FAILED';\n" +
            '  }',
          new_string:
            "if (lower.includes('backup failed') || lower.includes('backup error')) {\n" +
            "    return 'BACKUP_FAILED';\n" +
            '  }',
        },
        // Edit 5: Change fallback from UNKNOWN_ERROR to WRITE_FAILED
        {
          old_string: "return 'UNKNOWN_ERROR';",
          new_string: "return 'WRITE_FAILED';",
        },
      ],
    });
  }

  // 3. src/server.ts -- 5 edits: improve tool description strings
  const serverFile = target.files.find(
    (f) => f.file_path === 'src/server.ts',
  );
  if (serverFile) {
    edits.push({
      file_path: serverFile.file_path,
      edits: [
        // Edit 1: file_path description
        {
          old_string: "description: 'Absolute path to the file to modify',",
          new_string:
            "description: 'Absolute path to the file to modify (must exist)',",
        },
        // Edit 2: old_string description
        {
          old_string: "description: 'Text to find',",
          new_string: "description: 'Text to find (exact match required)',",
        },
        // Edit 3: new_string description
        {
          old_string: "description: 'Replacement text',",
          new_string:
            "description: 'Replacement text (can be empty string to delete)',",
        },
        // Edit 4: replace_all description
        {
          old_string:
            "description: 'Replace all occurrences (default: false)',",
          new_string:
            "description: 'Replace all occurrences instead of just the first (default: false)',",
        },
        // Edit 5: edits array description
        {
          old_string:
            "description: 'Array of edit operations (applied sequentially)',",
          new_string:
            "description: 'Array of edit operations applied sequentially',",
        },
      ],
    });
  }

  return edits;
}

/**
 * Validate synthetic results: verify error handling enhancements in all 4 files.
 */
async function validateSyntheticResults(
  target: BenchmarkTarget,
  workDir: string,
): Promise<ValidationResult> {
  const errors: string[] = [];

  const checks: Array<{
    file_path: string;
    must_contain: string[];
    must_not_contain: string[];
  }> = [
    {
      file_path: 'src/plugins/csv-plugin.ts',
      must_contain: [
        '[CSV_PROCESSING_ERROR]',
        "errorCode: 'CSV_PROCESSING_ERROR'",
        'string or Buffer',
        'empty: true',
        "'1.1.0'",
      ],
      must_not_contain: [
        "'CSV input must be a string'",
        'return { headers: [], rows: [] };',
        "readonly version = '1.0.0'",
      ],
    },
    {
      file_path: 'src/plugins/json-plugin.ts',
      must_contain: [
        '[JSON_PROCESSING_ERROR]',
        "errorCode: 'JSON_PROCESSING_ERROR'",
        '(parse error)',
        '_type: typeof input',
        "'1.1.0'",
      ],
      must_not_contain: [
        "'Invalid JSON string provided'",
        "readonly version = '1.0.0'",
      ],
    },
    {
      file_path: 'src/handlers/error-handler.ts',
      must_contain: [
        '[ERROR] Processing failed',
        '[ERROR] Validation failed',
        '[ERROR] Plugin',
        '[ERROR] Unexpected',
        '[ERROR] [',
      ],
      must_not_contain: [],
    },
    {
      file_path: 'src/handlers/input-handler.ts',
      must_contain: [
        '[WARN]',
        '[INFO]',
        '[ERROR]',
      ],
      must_not_contain: [],
    },
  ];

  for (const check of checks) {
    const fileMeta = target.files.find((f) => f.file_path === check.file_path);
    if (!fileMeta) {
      errors.push(`Expected file not found in target: ${check.file_path}`);
      continue;
    }

    const filePath = path.join(workDir, fileMeta.file_path);

    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (err) {
      errors.push(
        `Could not read ${fileMeta.file_path}: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    for (const expected of check.must_contain) {
      if (!content.includes(expected)) {
        errors.push(
          `${fileMeta.file_path}: expected '${expected}' but not found`,
        );
      }
    }

    for (const unexpected of check.must_not_contain) {
      if (content.includes(unexpected)) {
        errors.push(
          `${fileMeta.file_path}: '${unexpected}' still present after edit`,
        );
      }
    }
  }

  // Verify input-handler.ts has at least 3 [ERROR] occurrences
  const inputHandlerMeta = target.files.find(
    (f) => f.file_path === 'src/handlers/input-handler.ts',
  );
  if (inputHandlerMeta) {
    const filePath = path.join(workDir, inputHandlerMeta.file_path);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const errorCount = (content.match(/\[ERROR\]/g) || []).length;
      if (errorCount < 3) {
        errors.push(
          `${inputHandlerMeta.file_path}: expected at least 3 [ERROR] occurrences but found ${errorCount}`,
        );
      }
    } catch {
      // Already reported above
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate real-world results: verify error handling enhancements in all 3 files.
 */
async function validateRealWorldResults(
  target: BenchmarkTarget,
  workDir: string,
): Promise<ValidationResult> {
  const errors: string[] = [];

  const checks: Array<{
    file_path: string;
    must_contain: string[];
    must_not_contain: string[];
  }> = [
    {
      file_path: 'src/core/errors.ts',
      must_contain: [
        "'Consider using a shorter, more unique substring'",
        "'Include surrounding context to disambiguate'",
        "'Verify the working directory is correct'",
        "'Verify file ownership with ls -la'",
        "'Review the tool documentation for expected input shape'",
      ],
      must_not_contain: [],
    },
    {
      file_path: 'src/core/reporter.ts',
      must_contain: [
        "'no match'",
        "'multiple matches'",
        "'eperm'",
        "'backup error'",
        "'WRITE_FAILED'",
      ],
      must_not_contain: [],
    },
    {
      file_path: 'src/server.ts',
      must_contain: [
        '(must exist)',
        '(exact match required)',
        '(can be empty string to delete)',
        'instead of just the first',
        "applied sequentially'",
      ],
      must_not_contain: [],
    },
  ];

  for (const check of checks) {
    const fileMeta = target.files.find((f) => f.file_path === check.file_path);
    if (!fileMeta) {
      errors.push(`Expected file not found in target: ${check.file_path}`);
      continue;
    }

    const filePath = path.join(workDir, fileMeta.file_path);

    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (err) {
      errors.push(
        `Could not read ${fileMeta.file_path}: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    for (const expected of check.must_contain) {
      if (!content.includes(expected)) {
        errors.push(
          `${fileMeta.file_path}: expected '${expected}' but not found`,
        );
      }
    }

    for (const unexpected of check.must_not_contain) {
      if (content.includes(unexpected)) {
        errors.push(
          `${fileMeta.file_path}: '${unexpected}' still present after edit`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
