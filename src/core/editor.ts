/**
 * File editing engine
 *
 * Provides atomic multi-edit operations on files.
 */

import * as fs from 'fs/promises';
import type { EditOperation, EditResult, MultiEditResult } from '../types/index.js';

/**
 * Apply multiple edits to a file atomically
 *
 * @param filePath - Absolute path to the file
 * @param edits - Array of edit operations
 * @param dryRun - If true, preview changes without applying
 * @param createBackup - If true, create .bak file before editing
 * @returns Result of the multi-edit operation
 */
export async function applyEdits(
  filePath: string,
  edits: EditOperation[],
  dryRun: boolean = false,
  createBackup: boolean = false
): Promise<MultiEditResult> {
  // TODO: Implement
  // 1. Read file content
  // 2. Validate all edits can be applied
  // 3. Apply edits sequentially
  // 4. If any edit fails, rollback (atomic)
  // 5. Write result (unless dry_run)

  throw new Error('Not implemented');
}

/**
 * Find all occurrences of a string in content
 */
export function findOccurrences(content: string, searchString: string): number {
  if (!searchString) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = content.indexOf(searchString, pos)) !== -1) {
    count++;
    pos += searchString.length;
  }
  return count;
}

/**
 * Replace string in content
 *
 * @param content - File content
 * @param oldString - String to find
 * @param newString - Replacement string
 * @param replaceAll - Replace all occurrences
 * @returns Object with new content and replacement count
 */
export function replaceString(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean = false
): { content: string; replacedCount: number } {
  if (!oldString) {
    return { content, replacedCount: 0 };
  }

  if (replaceAll) {
    const occurrences = findOccurrences(content, oldString);
    const newContent = content.split(oldString).join(newString);
    return { content: newContent, replacedCount: occurrences };
  } else {
    const index = content.indexOf(oldString);
    if (index === -1) {
      return { content, replacedCount: 0 };
    }
    const newContent =
      content.substring(0, index) +
      newString +
      content.substring(index + oldString.length);
    return { content: newContent, replacedCount: 1 };
  }
}
