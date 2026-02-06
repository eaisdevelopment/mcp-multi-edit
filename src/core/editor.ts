/**
 * File editing engine
 *
 * Provides atomic multi-edit operations on files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { isUtf8 } from 'buffer';
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
 * Read file and validate it contains valid UTF-8 encoding
 *
 * @param filePath - Absolute path to the file
 * @returns File content as string
 * @throws Error with user-friendly message if file can't be read or isn't valid UTF-8
 */
export async function readFileValidated(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  if (!isUtf8(buffer)) {
    throw new Error(`File contains invalid UTF-8 encoding: ${filePath}. Ensure the file is UTF-8 encoded.`);
  }
  return buffer.toString('utf8');
}

/**
 * Write file atomically using temp-file-then-rename pattern
 *
 * Creates a temp file in the same directory, writes content, then renames.
 * This ensures the file is never left in a partial state.
 *
 * @param filePath - Absolute path to the target file
 * @param content - Content to write
 * @throws Error if write or rename fails
 */
export async function atomicWrite(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  const tempSuffix = crypto.randomBytes(6).toString('hex');
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${tempSuffix}.tmp`);

  try {
    await fs.writeFile(tempPath, content, 'utf8');
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors - temp file may not exist
    }
    throw error;
  }
}

/**
 * Format file operation errors into user-friendly messages with recovery hints
 *
 * @param error - The error that occurred
 * @param filePath - Path to the file that caused the error
 * @returns User-friendly error message
 */
export function formatFileError(error: unknown, filePath: string): string {
  if (error instanceof Error) {
    const message = error.message;
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === 'ENOENT' || message.includes('ENOENT')) {
      return `File not found: ${filePath}. Check that file exists.`;
    }
    if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM' ||
        message.includes('EACCES') || message.includes('EPERM')) {
      return `Permission denied: ${filePath}. Check file permissions.`;
    }
    if (message.includes('UTF-8') || message.includes('utf-8') || message.includes('encoding')) {
      return message; // Already formatted
    }
    return `File error: ${message}`;
  }
  return `Unknown file error: ${filePath}`;
}

/**
 * Apply multiple edits to a file atomically
 *
 * @param filePath - Absolute path to the file
 * @param edits - Array of edit operations
 * @param dryRun - If true, preview changes without applying
 * @param backup - If true, create .bak file before editing (default: true)
 * @returns Result of the multi-edit operation
 */
export async function applyEdits(
  filePath: string,
  edits: EditOperation[],
  dryRun: boolean = false,
  backup: boolean = true
): Promise<MultiEditResult> {
  // 1. Read file content
  let content: string;
  try {
    content = await readFileValidated(filePath);
  } catch (error) {
    return {
      success: false,
      file_path: filePath,
      edits_applied: 0,
      results: [],
      error: formatFileError(error, filePath),
      dry_run: dryRun,
    };
  }

  // 2. Apply edits using in-memory function
  const result = applyEditsToContent(filePath, content, edits, dryRun);

  // 3. If edits failed or dry run, return without writing
  if (!result.success || dryRun) {
    return result;
  }

  // 4. Create backup if requested
  if (backup) {
    try {
      const backupPath = `${filePath}.bak`;
      await fs.writeFile(backupPath, content, 'utf8');
      result.backup_path = backupPath;
    } catch (error) {
      return {
        ...result,
        success: false,
        error: formatFileError(error, `${filePath}.bak`),
      };
    }
  }

  // 5. Write result atomically
  try {
    await atomicWrite(filePath, result.final_content!);
  } catch (error) {
    return {
      ...result,
      success: false,
      error: formatFileError(error, filePath),
    };
  }

  return result;
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
