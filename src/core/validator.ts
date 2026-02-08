/**
 * Input validation using Zod
 */

import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { ValidationError, ValidationResult, MultiEditInput, MultiEditFilesInput } from '../types/index.js';
import { truncateForDisplay } from './reporter.js';

/**
 * Schema for a single edit operation
 */
export const EditOperationSchema = z.object({
  old_string: z.string().min(1, 'old_string cannot be empty'),
  new_string: z.string(),
  replace_all: z.boolean().optional().default(false),
});

/**
 * Schema for multi_edit input
 */
export const MultiEditInputSchema = z.object({
  file_path: z.string().min(1, 'file_path is required'),
  edits: z.array(EditOperationSchema).min(1, 'At least one edit is required'),
  dry_run: z.boolean().optional().default(false),
  backup: z.boolean().optional().default(true),
  include_content: z.boolean().optional().default(false),
});

/**
 * Schema for multi_edit_files input
 */
export const MultiEditFilesInputSchema = z.object({
  files: z.array(
    z.object({
      file_path: z.string().min(1),
      edits: z.array(EditOperationSchema).min(1),
    })
  ).min(1, 'At least one file is required'),
  dry_run: z.boolean().optional().default(false),
  backup: z.boolean().optional().default(true),
  include_content: z.boolean().optional().default(false),
});

/**
 * Validate multi_edit input
 */
export function validateMultiEditInput(input: unknown) {
  return MultiEditInputSchema.safeParse(input);
}

/**
 * Validate multi_edit_files input
 */
export function validateMultiEditFilesInput(input: unknown) {
  return MultiEditFilesInputSchema.safeParse(input);
}

/**
 * Check if file path is absolute
 * @deprecated Use validatePath for comprehensive path validation
 */
export function isAbsolutePath(filePath: string): boolean {
  return filePath.startsWith('/');
}

/**
 * Validate a file path for security and correctness
 * Returns null if valid, ValidationError if invalid
 */
export function validatePath(filePath: string): ValidationError | null {
  // Check for absolute path using Node's path module (cross-platform)
  if (!path.isAbsolute(filePath)) {
    return {
      code: 'RELATIVE_PATH',
      message: `Path must be absolute, received: "${truncateForDisplay(filePath, 50)}"`,
      path: ['file_path'],
      recovery_hint: 'Use absolute path (e.g., /home/user/project/file.ts)',
    };
  }

  // Check for directory traversal attempts (..)
  const segments = filePath.split(path.sep);
  if (segments.includes('..')) {
    return {
      code: 'PATH_TRAVERSAL',
      message: `Path contains directory traversal (..) which is not allowed: "${truncateForDisplay(filePath, 50)}"`,
      path: ['file_path'],
      recovery_hint: 'Use resolved absolute path without ".." segments',
    };
  }

  return null;
}

/**
 * Validate that a file exists and is accessible
 * Uses fs.realpath which resolves symlinks and checks existence
 * Returns resolved path on success, ValidationError on failure
 */
export async function validateFileExists(
  filePath: string
): Promise<{ resolvedPath: string } | ValidationError> {
  try {
    const resolvedPath = await fs.realpath(filePath);
    return { resolvedPath };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    const code = nodeError.code || 'UNKNOWN';

    switch (code) {
      case 'ENOENT':
        return {
          code: 'FILE_NOT_FOUND',
          message: `File does not exist: "${truncateForDisplay(filePath, 50)}"`,
          path: ['file_path'],
          recovery_hint: 'Check the file path and ensure the file exists',
        };
      case 'EACCES':
        return {
          code: 'PERMISSION_DENIED',
          message: `Permission denied accessing: "${truncateForDisplay(filePath, 50)}"`,
          path: ['file_path'],
          recovery_hint: 'Check file permissions or run with appropriate access',
        };
      case 'EPERM':
        return {
          code: 'OPERATION_NOT_PERMITTED',
          message: `Operation not permitted for: "${truncateForDisplay(filePath, 50)}"`,
          path: ['file_path'],
          recovery_hint: 'Check file permissions and ownership',
        };
      case 'ELOOP':
        return {
          code: 'SYMLINK_LOOP',
          message: `Too many symbolic links in path: "${truncateForDisplay(filePath, 50)}"`,
          path: ['file_path'],
          recovery_hint: 'Check for circular symlink references',
        };
      default:
        return {
          code: 'FILE_ACCESS_ERROR',
          message: `Cannot access file: "${truncateForDisplay(filePath, 50)}" (${code})`,
          path: ['file_path'],
          recovery_hint: 'Check file path and system error details',
        };
    }
  }
}

/**
 * Detect potentially overlapping edits
 * Returns indices of edits that might conflict
 */
export function detectOverlappingEdits(
  content: string,
  edits: Array<{ old_string: string; new_string: string }>
): number[] {
  const conflicts: number[] = [];

  for (let i = 0; i < edits.length; i++) {
    for (let j = i + 1; j < edits.length; j++) {
      // Check if edit j's old_string appears in edit i's new_string
      if (edits[i].new_string.includes(edits[j].old_string)) {
        conflicts.push(j);
      }
      // Check if edit i's old_string appears in edit j's old_string
      if (edits[j].old_string.includes(edits[i].old_string)) {
        conflicts.push(i);
      }
    }
  }

  return [...new Set(conflicts)];
}

/**
 * Detect duplicate old_strings in edits array
 * Returns ValidationError[] for any duplicates found
 */
export function detectDuplicateOldStrings(
  edits: Array<{ old_string: string; new_string: string }>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const seen = new Map<string, number>(); // old_string -> first occurrence index

  for (let i = 0; i < edits.length; i++) {
    const oldString = edits[i].old_string;
    const firstIndex = seen.get(oldString);

    if (firstIndex !== undefined) {
      errors.push({
        code: 'DUPLICATE_OLD_STRING',
        message: `Edit ${i + 1} of ${edits.length} has duplicate old_string: "${truncateForDisplay(oldString, 30)}" (first seen at edit ${firstIndex + 1})`,
        path: ['edits', String(i), 'old_string'],
        recovery_hint: 'Each edit must have a unique old_string. Combine edits or make old_strings more specific.',
      });
    } else {
      seen.set(oldString, i);
    }
  }

  return errors;
}

/**
 * Convert Zod error issues to ValidationError array
 */
export function formatZodErrors(zodError: z.ZodError): ValidationError[] {
  return zodError.issues.map((issue) => {
    const path = issue.path.map(String);
    let recoveryHint: string;

    switch (issue.code) {
      case 'too_small':
        if (issue.path.includes('edits')) {
          recoveryHint = 'Provide at least one edit operation';
        } else if (issue.path.includes('old_string')) {
          recoveryHint = 'old_string cannot be empty - specify text to find';
        } else if (issue.path.includes('file_path')) {
          recoveryHint = 'Provide a valid file path';
        } else {
          recoveryHint = 'Provide the required value';
        }
        break;
      case 'invalid_type':
        recoveryHint = `Expected ${issue.expected}, received ${issue.received}`;
        break;
      case 'invalid_string':
        recoveryHint = 'Check string format';
        break;
      default:
        recoveryHint = 'Check input format and try again';
    }

    return {
      code: `SCHEMA_${issue.code.toUpperCase()}`,
      message: issue.message,
      path: path.length > 0 ? path : undefined,
      recovery_hint: recoveryHint,
    };
  });
}

/**
 * Full validation for multi_edit input with layered checks
 * Layer 1: Schema validation (Zod)
 * Layer 2: Path validation (absolute, no traversal)
 * Layer 3: Duplicate detection
 * Layer 4: File existence check (async)
 */
export async function validateMultiEditInputFull(
  input: unknown
): Promise<ValidationResult<MultiEditInput>> {
  // Layer 1: Schema validation
  const schemaResult = MultiEditInputSchema.safeParse(input);
  if (!schemaResult.success) {
    return {
      success: false,
      errors: formatZodErrors(schemaResult.error),
    };
  }

  const data = schemaResult.data;

  // Layer 2: Path validation
  const pathError = validatePath(data.file_path);
  if (pathError) {
    return {
      success: false,
      errors: [pathError],
    };
  }

  // Layer 3: Duplicate detection
  const duplicateErrors = detectDuplicateOldStrings(data.edits);
  if (duplicateErrors.length > 0) {
    return {
      success: false,
      errors: duplicateErrors,
    };
  }

  // Layer 4: File existence check
  const existsResult = await validateFileExists(data.file_path);
  if ('code' in existsResult) {
    // It's a ValidationError
    return {
      success: false,
      errors: [existsResult],
    };
  }

  // Return validated data with potentially resolved path
  return {
    success: true,
    data: {
      ...data,
      file_path: existsResult.resolvedPath,
    },
  };
}

/**
 * Detect duplicate file paths across the files array
 * Resolves symlinks before comparison for accurate duplicate detection
 */
export async function detectDuplicateFilePaths(
  files: Array<{ file_path: string }>
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const resolvedMap = new Map<string, number>(); // resolved_path -> first_occurrence_index

  for (let i = 0; i < files.length; i++) {
    const existsResult = await validateFileExists(files[i].file_path);

    // If file doesn't exist, skip for duplicate detection (existence check catches it later)
    if ('code' in existsResult) {
      continue;
    }

    const resolvedPath = existsResult.resolvedPath;
    const firstIndex = resolvedMap.get(resolvedPath);

    if (firstIndex !== undefined) {
      errors.push({
        code: 'DUPLICATE_FILE_PATH',
        message: `Duplicate file path: "${files[i].file_path}" resolves to same location as files[${firstIndex}]`,
        path: ['files', String(i), 'file_path'],
        recovery_hint: 'Remove duplicate file paths — each file should appear only once',
      });
    } else {
      resolvedMap.set(resolvedPath, i);
    }
  }

  return errors;
}

/**
 * Full 5-layer validation pipeline for multi-file input
 * Collects ALL errors across ALL files before returning
 *
 * Layer 1: Zod schema validation (hard stop if fails — subsequent layers need parsed data)
 * Layer 2: Per-file path validation (absolute, no traversal)
 * Layer 3: Cross-file duplicate path detection (symlink-aware)
 * Layer 4: Per-file existence check
 * Layer 5: Per-file duplicate old_string detection
 */
export async function validateMultiEditFilesInputFull(
  input: unknown
): Promise<ValidationResult<MultiEditFilesInput>> {
  // Layer 1: Zod schema validation (hard stop)
  const schemaResult = MultiEditFilesInputSchema.safeParse(input);
  if (!schemaResult.success) {
    return {
      success: false,
      errors: formatZodErrors(schemaResult.error),
    };
  }

  const data = schemaResult.data;
  const allErrors: ValidationError[] = [];

  // Layers 2-5 run and collect all errors before returning

  // Layer 2: Per-file path validation
  for (let i = 0; i < data.files.length; i++) {
    const pathError = validatePath(data.files[i].file_path);
    if (pathError) {
      allErrors.push({
        ...pathError,
        path: ['files', String(i), 'file_path'],
      });
    }
  }

  // Layer 3: Cross-file duplicate path detection
  const duplicatePathErrors = await detectDuplicateFilePaths(data.files);
  allErrors.push(...duplicatePathErrors);

  // Layer 4: Per-file existence check (also collect resolved paths)
  const resolvedPaths = new Map<number, string>(); // index -> resolved path
  for (let i = 0; i < data.files.length; i++) {
    const existsResult = await validateFileExists(data.files[i].file_path);
    if ('code' in existsResult) {
      allErrors.push({
        ...existsResult,
        path: ['files', String(i), 'file_path'],
      });
    } else {
      resolvedPaths.set(i, existsResult.resolvedPath);
    }
  }

  // Layer 5: Per-file duplicate old_string detection
  for (let i = 0; i < data.files.length; i++) {
    const dupErrors = detectDuplicateOldStrings(data.files[i].edits);
    for (const dupError of dupErrors) {
      allErrors.push({
        ...dupError,
        path: ['files', String(i), ...(dupError.path ?? [])],
      });
    }
  }

  // If any errors were collected, return them all
  if (allErrors.length > 0) {
    return {
      success: false,
      errors: allErrors,
    };
  }

  // All passed — return data with resolved paths
  const resolvedFiles = data.files.map((file, i) => ({
    ...file,
    file_path: resolvedPaths.get(i) ?? file.file_path,
  }));

  return {
    success: true,
    data: {
      ...data,
      files: resolvedFiles,
    },
  };
}
