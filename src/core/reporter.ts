/**
 * Result formatting and reporting
 */

import type { MultiEditResult, MultiEditFilesResult, EditResult } from '../types/index.js';

/**
 * Format multi_edit result for MCP response
 */
export function formatMultiEditResult(result: MultiEditResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Format multi_edit_files result for MCP response
 */
export function formatMultiEditFilesResult(result: MultiEditFilesResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Create success result for multi_edit
 */
export function createSuccessResult(
  filePath: string,
  results: EditResult[],
  dryRun: boolean,
  backupPath?: string
): MultiEditResult {
  return {
    success: true,
    file_path: filePath,
    edits_applied: results.filter(r => r.success).length,
    results,
    dry_run: dryRun,
    backup_path: backupPath,
  };
}

/**
 * Create error result for multi_edit
 */
export function createErrorResult(
  filePath: string,
  error: string,
  failedIndex?: number,
  results?: EditResult[]
): MultiEditResult {
  return {
    success: false,
    file_path: filePath,
    edits_applied: 0,
    results: results || [],
    error,
    failed_edit_index: failedIndex,
    dry_run: false,
  };
}

/**
 * Create success result for multi_edit_files
 */
export function createFilesSuccessResult(
  fileResults: MultiEditResult[],
  dryRun: boolean
): MultiEditFilesResult {
  return {
    success: true,
    files_edited: fileResults.length,
    file_results: fileResults,
    dry_run: dryRun,
  };
}

/**
 * Create error result for multi_edit_files
 */
export function createFilesErrorResult(
  error: string,
  failedIndex?: number,
  fileResults?: MultiEditResult[]
): MultiEditFilesResult {
  return {
    success: false,
    files_edited: 0,
    file_results: fileResults || [],
    error,
    failed_file_index: failedIndex,
    dry_run: false,
  };
}

/**
 * Generate diff preview for dry run
 */
export function generateDiffPreview(
  originalContent: string,
  newContent: string,
  filePath: string
): string {
  // Simple diff - show changed lines
  const originalLines = originalContent.split('\n');
  const newLines = newContent.split('\n');

  const changes: string[] = [];
  changes.push(`--- ${filePath} (original)`);
  changes.push(`+++ ${filePath} (modified)`);

  // Simple line-by-line comparison
  const maxLines = Math.max(originalLines.length, newLines.length);
  for (let i = 0; i < maxLines; i++) {
    const origLine = originalLines[i];
    const newLine = newLines[i];

    if (origLine !== newLine) {
      if (origLine !== undefined) {
        changes.push(`- ${origLine}`);
      }
      if (newLine !== undefined) {
        changes.push(`+ ${newLine}`);
      }
    }
  }

  return changes.join('\n');
}
