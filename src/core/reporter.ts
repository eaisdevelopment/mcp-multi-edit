/**
 * Result formatting and reporting
 */

import type { MultiEditResult, MultiEditFilesResult, EditResult } from '../types/index.js';

/**
 * Response types for MCP formatting
 */
export interface SuccessResponse {
  success: true;
  file_path: string;
  edits_applied: number;
  dry_run: boolean;
  edits: Array<{
    old_string: string;
    matched: boolean;
    occurrences_replaced: number;
  }>;
  backup_path?: string;
  final_content?: string;
}

export interface ErrorResponse {
  success: false;
  file_path: string;
  error: string;
  failed_edit_index?: number;
  edits_applied: 0;
  message: string;
  recovery_hint: string;
  context_snippet?: string;
}

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
 * Truncate a string for display, adding ellipsis if truncated
 */
export function truncateForDisplay(str: string, maxLen: number): string {
  if (str.length <= maxLen) {
    return str;
  }
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Get recovery hint based on error message
 */
export function getRecoveryHint(error: string): string {
  const lowerError = error.toLowerCase();

  if (lowerError.includes('not found')) {
    return 'Read the file to see current content, then retry with correct old_string.';
  }
  if (lowerError.includes('permission denied') || lowerError.includes('eacces')) {
    return 'Check file permissions.';
  }
  if (lowerError.includes('matches at lines') || lowerError.includes('multiple matches') || lowerError.includes('occurrences found')) {
    return 'Use replace_all: true or make old_string more specific.';
  }
  if (lowerError.includes('utf-8') || lowerError.includes('utf8') || lowerError.includes('encoding')) {
    return 'Ensure file uses UTF-8 encoding.';
  }

  return 'Check error details and retry.';
}

/**
 * Extract context snippet around expected match location
 * Returns ~50 chars around where the match was expected
 */
export function extractContextSnippet(
  fileContent: string,
  searchString: string,
  radius: number = 25
): string | undefined {
  if (!fileContent || fileContent.length === 0) {
    return undefined;
  }

  // Try to find a partial match using first ~20 chars of search string
  const searchPrefix = searchString.slice(0, Math.min(20, searchString.length));
  let matchIndex = fileContent.indexOf(searchPrefix);

  // If no exact prefix match, try case-insensitive
  if (matchIndex === -1) {
    matchIndex = fileContent.toLowerCase().indexOf(searchPrefix.toLowerCase());
  }

  // If still no match, try with shorter prefix
  if (matchIndex === -1 && searchPrefix.length > 5) {
    const shorterPrefix = searchPrefix.slice(0, 5);
    matchIndex = fileContent.indexOf(shorterPrefix);
  }

  if (matchIndex !== -1) {
    const start = Math.max(0, matchIndex - radius);
    const end = Math.min(fileContent.length, matchIndex + radius);
    const before = fileContent.slice(start, matchIndex);
    const after = fileContent.slice(matchIndex, end);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < fileContent.length ? '...' : '';
    return `${prefix}${before}[HERE]${after}${suffix}`;
  }

  // No partial match found, return start of file
  const previewLen = Math.min(50, fileContent.length);
  const suffix = fileContent.length > previewLen ? '...' : '';
  return `File starts with: ${fileContent.slice(0, previewLen)}${suffix}`;
}

/**
 * Format multi_edit result for MCP response
 * Returns structured response object per CONTEXT.md decisions
 */
export function formatMultiEditResponse(
  result: MultiEditResult,
  includeContent: boolean,
  totalEdits: number,
  fileContent?: string
): SuccessResponse | ErrorResponse {
  if (result.success) {
    const response: SuccessResponse = {
      success: true,
      file_path: result.file_path,
      edits_applied: result.edits_applied,
      dry_run: result.dry_run,
      edits: result.results.map(r => ({
        old_string: truncateForDisplay(r.old_string, 50),
        matched: r.success,
        occurrences_replaced: r.replaced,
      })),
    };

    if (result.backup_path) {
      response.backup_path = result.backup_path;
    }

    // Only include final_content when explicitly requested
    if (includeContent && result.final_content) {
      response.final_content = result.final_content;
    }

    return response;
  }

  // Error response
  const failedIndex = result.failed_edit_index ?? 0;
  const errorMessage = `Edit ${failedIndex + 1} of ${totalEdits} failed: ${result.error || 'Unknown error'}`;

  const response: ErrorResponse = {
    success: false,
    file_path: result.file_path,
    error: errorMessage,
    failed_edit_index: result.failed_edit_index,
    edits_applied: 0,
    message: 'Operation failed. No changes applied - file unchanged.',
    recovery_hint: getRecoveryHint(result.error || ''),
  };

  // Add context snippet for match errors
  if (fileContent && result.error && result.error.toLowerCase().includes('not found')) {
    const failedEdit = result.results[failedIndex];
    if (failedEdit) {
      const snippet = extractContextSnippet(fileContent, failedEdit.old_string);
      if (snippet) {
        response.context_snippet = snippet;
      }
    }
  }

  return response;
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
