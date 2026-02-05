/**
 * Input validation using Zod
 */

import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { ValidationError, ValidationResult, MultiEditInput } from '../types/index.js';
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
  create_backup: z.boolean().optional().default(false),
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
  create_backup: z.boolean().optional().default(false),
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
