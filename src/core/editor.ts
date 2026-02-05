/**
 * File editing engine
 *
 * Provides atomic multi-edit operations on files.
 */

import * as fs from 'fs/promises';
import type { EditOperation, EditResult, MultiEditResult } from '../types/index.js';

/**
 * Get line number for a character index in content (1-based)
 */
export function getLineNumber(content: string, charIndex: number): number {
  const lines = content.substring(0, charIndex).split('\n');
  return lines.length;
}

/**
 * Find all match positions of a string in content
 * @param content - The content to search in
 * @param searchString - The string to find
 * @param caseInsensitive - Whether to match case-insensitively
 * @returns Array of character indices where matches start
 */
export function findAllMatchPositions(
  content: string,
  searchString: string,
  caseInsensitive: boolean = false
): number[] {
  if (!searchString) return [];

  const positions: number[] = [];
  const searchIn = caseInsensitive ? content.toLowerCase() : content;
  const searchFor = caseInsensitive ? searchString.toLowerCase() : searchString;

  let pos = 0;
  while ((pos = searchIn.indexOf(searchFor, pos)) !== -1) {
    positions.push(pos);
    pos += searchFor.length;
  }
  return positions;
}

/**
 * Get line numbers of all matches (1-based)
 */
export function getMatchLineNumbers(
  content: string,
  searchString: string,
  caseInsensitive: boolean = false
): number[] {
  const positions = findAllMatchPositions(content, searchString, caseInsensitive);
  return positions.map(pos => getLineNumber(content, pos));
}

/**
 * Replace string with case-insensitive support
 */
export function replaceStringCaseAware(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean = false,
  caseInsensitive: boolean = false
): { content: string; replacedCount: number } {
  if (!oldString) {
    return { content, replacedCount: 0 };
  }

  const positions = findAllMatchPositions(content, oldString, caseInsensitive);
  if (positions.length === 0) {
    return { content, replacedCount: 0 };
  }

  if (replaceAll) {
    // Replace all occurrences from end to start to preserve positions
    let result = content;
    for (let i = positions.length - 1; i >= 0; i--) {
      const pos = positions[i];
      result = result.substring(0, pos) + newString + result.substring(pos + oldString.length);
    }
    return { content: result, replacedCount: positions.length };
  } else {
    // Replace only first occurrence
    const pos = positions[0];
    const result = content.substring(0, pos) + newString + content.substring(pos + oldString.length);
    return { content: result, replacedCount: 1 };
  }
}

/**
 * Apply multiple edits to content (in-memory, no file I/O)
 *
 * This is the core editing logic used for validation and testing.
 * Uses sequential simulation - each edit is validated and applied
 * to the result of previous edits.
 *
 * @param filePath - Path to file (used for error messages)
 * @param content - File content to edit
 * @param edits - Array of edit operations
 * @param dryRun - If true, mark as dry run in result
 * @returns Result of the multi-edit operation
 */
export function applyEditsToContent(
  filePath: string,
  content: string,
  edits: EditOperation[],
  dryRun: boolean = false
): MultiEditResult {
  // Handle empty edits array
  if (edits.length === 0) {
    return {
      success: true,
      file_path: filePath,
      edits_applied: 0,
      results: [],
      dry_run: dryRun,
      final_content: content,
    };
  }

  const results: EditResult[] = [];
  let currentContent = content;

  // Process each edit sequentially
  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    const totalEdits = edits.length;
    const caseInsensitive = edit.case_insensitive ?? false;

    // Check for no-op edit (old_string === new_string)
    if (edit.old_string === edit.new_string) {
      results.push({
        old_string: edit.old_string,
        matches: findOccurrences(currentContent, edit.old_string),
        replaced: 0,
        success: true,
      });
      continue;
    }

    // Find all match positions
    const positions = findAllMatchPositions(currentContent, edit.old_string, caseInsensitive);
    const matchCount = positions.length;

    // Zero matches is an error
    if (matchCount === 0) {
      return {
        success: false,
        file_path: filePath,
        edits_applied: i,
        results,
        error: `Edit ${i + 1} of ${totalEdits} failed: "${edit.old_string}" not found in file`,
        failed_edit_index: i,
        dry_run: dryRun,
        final_content: currentContent,
      };
    }

    // Multiple matches without replace_all is an error
    if (matchCount > 1 && !edit.replace_all) {
      const lineNumbers = positions.map(pos => getLineNumber(currentContent, pos));
      return {
        success: false,
        file_path: filePath,
        edits_applied: i,
        results,
        error: `Edit ${i + 1} of ${totalEdits} failed: Found ${matchCount} matches at lines ${lineNumbers.join(', ')}. Use replace_all: true to replace all occurrences.`,
        failed_edit_index: i,
        dry_run: dryRun,
        final_content: currentContent,
      };
    }

    // Apply the edit
    const { content: newContent, replacedCount } = replaceStringCaseAware(
      currentContent,
      edit.old_string,
      edit.new_string,
      edit.replace_all ?? false,
      caseInsensitive
    );

    results.push({
      old_string: edit.old_string,
      matches: matchCount,
      replaced: replacedCount,
      success: true,
    });

    currentContent = newContent;
  }

  // All edits succeeded
  return {
    success: true,
    file_path: filePath,
    edits_applied: results.filter(r => r.success).length,
    results,
    dry_run: dryRun,
    final_content: currentContent,
  };
}

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
