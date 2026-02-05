/**
 * Input validation using Zod
 */

import { z } from 'zod';

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
 */
export function isAbsolutePath(filePath: string): boolean {
  return filePath.startsWith('/');
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
