/**
 * Logging and observability benchmark scenario (SCEN-04).
 *
 * Adds logging context, rule annotations, improved validation messages,
 * and prototype chain fixes across multiple files to measure multi-edit
 * efficiency for cross-cutting observability improvements.
 *
 * - Synthetic target: 4 files, 21 edits (processor, transformer, validator, errors)
 * - Real-world target: 3 files, 17 edits (editor, validator, multi-edit)
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
 * Create the logging and observability benchmark scenario.
 *
 * Returns a BenchmarkScenario that adds observability improvements:
 * - Synthetic: step comments in processor, rule annotations in transformer,
 *   improved validation messages, and prototype chain fixes in errors (4 files, 21 edits)
 * - Real-world: enhanced JSDoc in editor, improved validation messages in validator,
 *   and clearer error formatting in multi-edit (3 files, 17 edits)
 */
export function createLoggingScenario(): BenchmarkScenario {
  return {
    name: 'logging-observability',
    category: 'feature-add',
    description:
      'Add logging context, rule annotations, improved validation messages, and prototype chain fixes. Synthetic: 4 files, 21 edits. Real-world: 3 files, 17 edits.',

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
 * Generate edits for the synthetic target: logging and observability improvements.
 *
 * 1. src/core/processor.ts: Add step comments and bump version (5 edits)
 * 2. src/core/transformer.ts: Add rule annotations to return values (6 edits, one with replace_all)
 * 3. src/core/validator.ts: Improve validation error messages (5 edits)
 * 4. src/utils/errors.ts: Fix prototype chain and improve type guards (5 edits)
 */
function generateSyntheticEdits(target: BenchmarkTarget): FileEdits[] {
  const edits: FileEdits[] = [];

  // 1. src/core/processor.ts -- Add step comments and bump version (5 edits)
  const processorFile = target.files.find(
    (f) => f.file_path === 'src/core/processor.ts',
  );
  if (processorFile) {
    edits.push({
      file_path: processorFile.file_path,
      edits: [
        {
          old_string: 'const configValidation = validateConfig(config);',
          new_string:
            '// Step 1: Validate configuration\n  const configValidation = validateConfig(config);',
        },
        {
          old_string: 'const format = detectFormat(input);',
          new_string:
            '// Step 2: Detect input format\n  const format = detectFormat(input);',
        },
        {
          old_string: 'const schemaRules = buildSchemaRules(format);',
          new_string:
            '// Step 3: Build schema rules\n  const schemaRules = buildSchemaRules(format);',
        },
        {
          old_string: 'const transformRules = selectTransformRules(format, config);',
          new_string:
            '// Step 4: Select transform rules\n  const transformRules = selectTransformRules(format, config);',
        },
        {
          old_string: "return '1.0.0';",
          new_string: "return '1.1.0';",
        },
      ],
    });
  }

  // 2. src/core/transformer.ts -- Add rule annotations to return values (6 edits)
  const transformerFile = target.files.find(
    (f) => f.file_path === 'src/core/transformer.ts',
  );
  if (transformerFile) {
    edits.push({
      file_path: transformerFile.file_path,
      edits: [
        {
          old_string:
            '{ success: true, data: data.toUpperCase() }',
          new_string:
            "{ success: true, data: data.toUpperCase(), rule: 'uppercase' }",
        },
        {
          old_string:
            '{ success: true, data: data.toLowerCase() }',
          new_string:
            "{ success: true, data: data.toLowerCase(), rule: 'lowercase' }",
        },
        {
          old_string: '{ success: true, data: data.trim() }',
          new_string:
            "{ success: true, data: data.trim(), rule: 'trim' }",
        },
        {
          old_string:
            '{ success: true, data: flattenObject(data as Record<string, unknown>) }',
          new_string:
            "{ success: true, data: flattenObject(data as Record<string, unknown>), rule: 'flatten' }",
        },
        {
          old_string:
            '{ success: false, data, error: `Unknown rule: ${rule}` }',
          new_string:
            "{ success: false, data, error: `Unknown rule: ${rule}`, rule: 'unknown' }",
        },
        {
          old_string:
            "{ success: false, data, error: 'Input is not a string' }",
          new_string:
            '{ success: false, data, error: \'Input is not a string\', rule }',
          replace_all: true,
        },
      ],
    });
  }

  // 3. src/core/validator.ts -- Improve validation error messages (5 edits)
  const validatorFile = target.files.find(
    (f) => f.file_path === 'src/core/validator.ts',
  );
  if (validatorFile) {
    edits.push({
      file_path: validatorFile.file_path,
      edits: [
        {
          old_string: 'return `Field "${field}" is required`;',
          new_string: 'return `Validation: field "${field}" is required`;',
        },
        {
          old_string: 'return `Field "${field}" must be a string`;',
          new_string: 'return `Validation: field "${field}" must be a string`;',
        },
        {
          old_string: 'return `Field "${field}" must be a number`;',
          new_string: 'return `Validation: field "${field}" must be a number`;',
        },
        {
          old_string: 'return `Field "${field}" must be a boolean`;',
          new_string: 'return `Validation: field "${field}" must be a boolean`;',
        },
        {
          old_string: "errors.push('maxRetries must be non-negative');",
          new_string:
            "errors.push('Config validation: maxRetries must be non-negative');",
        },
      ],
    });
  }

  // 4. src/utils/errors.ts -- Fix prototype chain and improve type guards (5 edits)
  const errorsFile = target.files.find(
    (f) => f.file_path === 'src/utils/errors.ts',
  );
  if (errorsFile) {
    edits.push({
      file_path: errorsFile.file_path,
      edits: [
        {
          old_string: "this.name = 'ProcessingError';",
          new_string:
            "this.name = 'ProcessingError';\n    Object.setPrototypeOf(this, ProcessingError.prototype);",
        },
        {
          old_string: "this.name = 'ValidationError';",
          new_string:
            "this.name = 'ValidationError';\n    Object.setPrototypeOf(this, ValidationError.prototype);",
        },
        {
          old_string: "this.name = 'PluginError';",
          new_string:
            "this.name = 'PluginError';\n    Object.setPrototypeOf(this, PluginError.prototype);",
        },
        {
          old_string: 'return error instanceof ProcessingError;',
          new_string:
            "return error instanceof ProcessingError || (error instanceof Error && error.name === 'ProcessingError');",
        },
        {
          old_string: 'return error instanceof ValidationError;',
          new_string:
            "return error instanceof ValidationError || (error instanceof Error && error.name === 'ValidationError');",
        },
      ],
    });
  }

  return edits;
}

/**
 * Generate edits for the real-world target: observability improvements.
 *
 * 1. src/core/editor.ts: Enhance JSDoc comments (6 edits)
 * 2. src/core/validator.ts: Improve validation error messages (6 edits)
 * 3. src/tools/multi-edit.ts: Improve error formatting and comments (5 edits)
 */
function generateRealWorldEdits(target: BenchmarkTarget): FileEdits[] {
  const edits: FileEdits[] = [];

  // 1. src/core/editor.ts -- Enhance JSDoc comments (6 edits)
  const editorFile = target.files.find(
    (f) => f.file_path === 'src/core/editor.ts',
  );
  if (editorFile) {
    edits.push({
      file_path: editorFile.file_path,
      edits: [
        {
          old_string:
            '* Get line number for a character index in content (1-based)',
          new_string:
            '* Get line number for a character index in content (1-based).\n * Returns the line number where the character at charIndex appears.',
        },
        {
          old_string:
            '* Find all match positions of a string in content',
          new_string:
            '* Find all match positions of a string in content.\n * Returns empty array if searchString is empty or not found.',
        },
        {
          old_string:
            '* Apply multiple edits to content (in-memory, no file I/O)',
          new_string:
            '* Apply multiple edits to content (in-memory, no file I/O).\n * Edits are applied sequentially; each edit sees the result of previous edits.',
        },
        {
          old_string:
            '* Replace string with case-insensitive support',
          new_string:
            '* Replace string with case-insensitive support.\n * When replaceAll is true, replaces all occurrences from end to start.',
        },
        {
          old_string:
            '* Get line numbers of all matches (1-based)',
          new_string:
            '* Get line numbers of all matches (1-based).\n * Returns an array of 1-based line numbers for each match position.',
        },
        {
          old_string: '* File editing engine',
          new_string:
            '* File editing engine.\n * Provides atomic multi-edit operations with backup and rollback support.',
        },
      ],
    });
  }

  // 2. src/core/validator.ts -- Improve validation error messages (6 edits)
  const validatorFile = target.files.find(
    (f) => f.file_path === 'src/core/validator.ts',
  );
  if (validatorFile) {
    edits.push({
      file_path: validatorFile.file_path,
      edits: [
        {
          old_string:
            "old_string: z.string().min(1, 'old_string cannot be empty'),",
          new_string:
            "old_string: z.string().min(1, 'old_string is required and cannot be empty'),",
        },
        {
          old_string:
            "file_path: z.string().min(1, 'file_path is required'),",
          new_string:
            "file_path: z.string().min(1, 'file_path is required and must be an absolute path'),",
        },
        {
          old_string:
            ").min(1, 'At least one file is required'),",
          new_string:
            ").min(1, 'At least one file entry is required'),",
        },
        {
          old_string:
            ").min(1, 'At least one edit is required'),",
          new_string:
            ").min(1, 'At least one edit operation is required'),",
        },
        {
          old_string:
            "recovery_hint: 'Use absolute path (e.g., /home/user/project/file.ts)',",
          new_string:
            "recovery_hint: 'Provide an absolute path starting with / (e.g., /home/user/project/file.ts)',",
        },
        {
          old_string:
            'recovery_hint: \'Use resolved absolute path without ".." segments\',',
          new_string:
            'recovery_hint: \'Resolve the path to remove ".." segments before passing it\',',
        },
      ],
    });
  }

  // 3. src/tools/multi-edit.ts -- Improve error formatting and comments (5 edits)
  const multiEditFile = target.files.find(
    (f) => f.file_path === 'src/tools/multi-edit.ts',
  );
  if (multiEditFile) {
    edits.push({
      file_path: multiEditFile.file_path,
      edits: [
        {
          old_string: "message: 'Input validation failed',",
          new_string: "message: 'multi_edit input validation failed',",
        },
        {
          old_string:
            'recovery_hints: validation.errors.map(e => `${e.code}: ${e.message} (${e.recovery_hint})`),',
          new_string:
            'recovery_hints: validation.errors.map(e => `[${e.code}] ${e.message} -- ${e.recovery_hint}`),',
        },
        {
          old_string:
            'fileContent,  // Pass as originalContent - safe because file not modified when dry_run=true',
          new_string:
            'fileContent,  // Original content for diff generation (safe: file unmodified during dry-run)',
        },
        {
          old_string:
            'input.edits   // Pass edits for per-edit status in ErrorEnvelope',
          new_string:
            'input.edits   // Original edits array for per-edit status tracking in ErrorEnvelope',
        },
        {
          old_string: 'isError: !result.success,',
          new_string: 'isError: result.success === false,',
        },
      ],
    });
  }

  return edits;
}

/**
 * Validate synthetic results: step comments, rule annotations, improved messages,
 * and prototype chain fixes must all be present.
 */
async function validateSyntheticResults(
  target: BenchmarkTarget,
  workDir: string,
): Promise<ValidationResult> {
  const errors: string[] = [];

  const checks: Array<{ file_path: string; must_contain: string[] }> = [
    {
      file_path: 'src/core/processor.ts',
      must_contain: [
        '// Step 1:',
        '// Step 2:',
        '// Step 3:',
        '// Step 4:',
        "'1.1.0'",
      ],
    },
    {
      file_path: 'src/core/transformer.ts',
      must_contain: [
        "rule: 'uppercase'",
        "rule: 'lowercase'",
        "rule: 'trim'",
        "rule: 'flatten'",
        "rule: 'unknown'",
      ],
    },
    {
      file_path: 'src/core/validator.ts',
      must_contain: [
        'Validation: field',
        'Config validation: maxRetries',
      ],
    },
    {
      file_path: 'src/utils/errors.ts',
      must_contain: [
        'Object.setPrototypeOf',
        "error.name === 'ProcessingError'",
        "error.name === 'ValidationError'",
      ],
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
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate real-world results: enhanced JSDoc, improved validation messages,
 * and clearer error formatting must all be present.
 */
async function validateRealWorldResults(
  target: BenchmarkTarget,
  workDir: string,
): Promise<ValidationResult> {
  const errors: string[] = [];

  const checks: Array<{ file_path: string; must_contain: string[] }> = [
    {
      file_path: 'src/core/editor.ts',
      must_contain: [
        'Returns the line number where',
        'Returns empty array if',
        'Edits are applied sequentially',
        'When replaceAll is true',
        'Returns an array of 1-based',
        'Provides atomic multi-edit operations with backup',
      ],
    },
    {
      file_path: 'src/core/validator.ts',
      must_contain: [
        'is required and cannot be empty',
        'must be an absolute path',
        'file entry is required',
        'edit operation is required',
        'Provide an absolute path starting with /',
        'Resolve the path to remove',
      ],
    },
    {
      file_path: 'src/tools/multi-edit.ts',
      must_contain: [
        'multi_edit input validation failed',
        '[${e.code}]',
        'Original content for diff generation',
        'Original edits array for per-edit status tracking',
        'result.success === false',
      ],
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
  }

  return { valid: errors.length === 0, errors };
}
