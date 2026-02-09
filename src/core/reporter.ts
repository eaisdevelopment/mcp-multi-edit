/**
 * Result formatting and reporting
 */

import type { MultiEditResult, MultiEditFilesResult, ErrorEnvelope, ErrorCode, ErrorContext } from '../types/index.js';
import { createErrorEnvelope, extractFileContext, extractMatchLocations, buildEditStatus } from './errors.js';
import { findAllMatchPositions } from './editor.js';

/**
 * Response types for MCP formatting
 */
export interface SuccessResponse {
  success: true;
  file_path: string;
  edits_applied: number;
  dry_run: boolean;
  message?: string;           // Dry-run messaging
  diff_preview?: string;      // Line-by-line diff for dry-run
  edits: Array<{
    old_string: string;
    matched: boolean;
    occurrences_replaced: number;
  }>;
  backup_path?: string;
  final_content?: string;
}

/**
 * Create success result for multi_edit_files
 * Populates top-level summary with file and edit counts
 */
export function createFilesSuccessResult(
  fileResults: MultiEditResult[],
  dryRun: boolean
): MultiEditFilesResult {
  const filesSucceeded = fileResults.filter(r => r.success).length;
  const totalEdits = fileResults.reduce((sum, r) => sum + r.edits_applied, 0);
  return {
    success: true,
    files_edited: fileResults.length,
    file_results: fileResults,
    summary: {
      total_files: fileResults.length,
      files_succeeded: filesSucceeded,
      files_failed: fileResults.length - filesSucceeded,
      total_edits: totalEdits,
    },
    dry_run: dryRun,
  };
}

/**
 * Format multi_edit_files result for MCP response
 * Strips final_content from each file result when includeContent is false
 */
export function formatMultiEditFilesResponse(
  result: MultiEditFilesResult,
  includeContent: boolean = false
): string {
  if (!includeContent) {
    // Strip final_content from each file result before serializing
    const stripped = {
      ...result,
      file_results: result.file_results.map(fr => {
        const { final_content, ...rest } = fr;
        return rest;
      }),
    };
    return JSON.stringify(stripped, null, 2);
  }
  return JSON.stringify(result, null, 2);
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
 * Classify error code from an error message string
 */
function classifyErrorFromMessage(errorMessage: string): ErrorCode {
  const lower = errorMessage.toLowerCase();

  if (lower.includes('not found')) {
    return 'MATCH_NOT_FOUND';
  }
  if (lower.includes('matches at lines') || lower.includes('occurrences found')) {
    return 'AMBIGUOUS_MATCH';
  }
  if (lower.includes('permission denied') || lower.includes('eacces')) {
    return 'PERMISSION_DENIED';
  }
  if (lower.includes('utf-8') || lower.includes('encoding')) {
    return 'INVALID_ENCODING';
  }
  if (lower.includes('backup failed')) {
    return 'BACKUP_FAILED';
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Format multi_edit result for MCP response
 * Returns structured response object per CONTEXT.md decisions
 */
export function formatMultiEditResponse(
  result: MultiEditResult,
  includeContent: boolean,
  totalEdits: number,
  fileContent?: string,
  originalContent?: string,  // For dry-run diff generation
  edits?: Array<{ old_string: string }>
): SuccessResponse | ErrorEnvelope {
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

    // Add dry-run specific fields
    if (result.dry_run) {
      response.message = 'DRY RUN - No changes made to file';
      // Generate diff preview if we have both original and final content
      if (originalContent && result.final_content) {
        response.diff_preview = generateDiffPreview(
          originalContent,
          result.final_content,
          result.file_path
        );
      }
    }

    if (result.backup_path) {
      response.backup_path = result.backup_path;
    }

    // Only include final_content when explicitly requested
    if (includeContent && result.final_content) {
      response.final_content = result.final_content;
    }

    return response;
  }

  // Error response - produce ErrorEnvelope
  const failedIndex = result.failed_edit_index ?? 0;
  const rawError = result.error || 'Unknown error';
  const errorMessage = `Edit ${failedIndex + 1} of ${totalEdits} failed: ${rawError}`;
  const errorCode = classifyErrorFromMessage(rawError);

  // Build context based on error type
  let context: ErrorContext | undefined;

  if (errorCode === 'MATCH_NOT_FOUND' && fileContent) {
    const failedEdit = result.results[failedIndex];
    if (failedEdit) {
      context = extractFileContext(fileContent, failedEdit.old_string);
    }
  } else if (errorCode === 'AMBIGUOUS_MATCH' && fileContent) {
    const failedEdit = result.results[failedIndex];
    if (failedEdit) {
      // Re-find match positions using editor's findAllMatchPositions
      const positions = findAllMatchPositions(fileContent, failedEdit.old_string);
      if (positions.length > 0) {
        context = extractMatchLocations(fileContent, failedEdit.old_string, positions);
      }
    }
  }

  // Build per-edit status when original edits array is provided
  let editStatus = undefined;
  if (edits && edits.length > 0) {
    editStatus = buildEditStatus(edits, failedIndex, errorCode, rawError);
  }

  return createErrorEnvelope({
    error_code: errorCode,
    message: errorMessage,
    file_path: result.file_path,
    edit_index: failedIndex,
    context,
    edit_status: editStatus,
    backup_path: result.backup_path,
  });
}

/**
 * Generate diff preview for dry run
 * Shows line-by-line changes with line numbers for easier reference
 */
export function generateDiffPreview(
  originalContent: string,
  newContent: string,
  filePath: string
): string {
  // Handle no-change case
  if (originalContent === newContent) {
    return 'No changes';
  }

  // Simple diff - show changed lines with line numbers
  const originalLines = originalContent.split('\n');
  const newLines = newContent.split('\n');

  const changes: string[] = [];
  changes.push(`--- ${filePath} (original)`);
  changes.push(`+++ ${filePath} (modified)`);

  // Simple line-by-line comparison with line numbers
  const maxLines = Math.max(originalLines.length, newLines.length);
  for (let i = 0; i < maxLines; i++) {
    const origLine = originalLines[i];
    const newLine = newLines[i];
    const lineNum = i + 1; // 1-indexed line numbers

    if (origLine !== newLine) {
      if (origLine !== undefined) {
        changes.push(`L${lineNum}: - ${origLine}`);
      }
      if (newLine !== undefined) {
        changes.push(`L${lineNum}: + ${newLine}`);
      }
    }
  }

  return changes.join('\n');
}
