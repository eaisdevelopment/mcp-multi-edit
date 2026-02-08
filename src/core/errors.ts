/**
 * Error infrastructure for EAIS MCP Multi-Edit Server
 *
 * Provides error classification, context extraction, envelope creation,
 * and per-edit status tracking.
 */

import type {
  ErrorCode,
  ErrorEnvelope,
  ErrorContext,
  EditStatusEntry,
  MatchLocation,
} from '../types/index.js';

/**
 * Set of error codes that are retryable (user can fix input and retry)
 */
export const RETRYABLE_CODES: Set<ErrorCode> = new Set([
  'VALIDATION_FAILED',
  'RELATIVE_PATH',
  'PATH_TRAVERSAL',
  'EMPTY_EDITS',
  'EMPTY_OLD_STRING',
  'DUPLICATE_OLD_STRING',
  'DUPLICATE_FILE_PATH',
  'MATCH_NOT_FOUND',
  'AMBIGUOUS_MATCH',
]);

/**
 * Check if an error code is retryable
 */
export function isRetryable(code: ErrorCode): boolean {
  return RETRYABLE_CODES.has(code);
}

/**
 * Classify a caught error into an error code and message
 */
export function classifyError(
  error: unknown,
  filePath?: string
): { error_code: ErrorCode; message: string } {
  if (error instanceof Error) {
    const nodeError = error as NodeJS.ErrnoException;
    const code = nodeError.code;

    if (code === 'ENOENT') {
      return { error_code: 'FILE_NOT_FOUND', message: error.message };
    }
    if (code === 'EACCES' || code === 'EPERM') {
      return { error_code: 'PERMISSION_DENIED', message: error.message };
    }
    if (code === 'ENOSPC') {
      return { error_code: 'DISK_FULL', message: error.message };
    }
    if (code === 'EROFS') {
      return { error_code: 'READ_ONLY_FS', message: error.message };
    }
    if (code === 'ELOOP') {
      return { error_code: 'SYMLINK_LOOP', message: error.message };
    }

    // Check message for encoding issues
    const msg = error.message.toLowerCase();
    if (msg.includes('utf-8') || msg.includes('utf8') || msg.includes('encoding')) {
      return { error_code: 'INVALID_ENCODING', message: error.message };
    }

    return { error_code: 'UNKNOWN_ERROR', message: error.message };
  }

  return {
    error_code: 'UNKNOWN_ERROR',
    message: filePath ? `Unknown error on ${filePath}` : 'Unknown error',
  };
}

/**
 * Get recovery hints based on error code
 * Returns general guidance, not prescriptive instructions
 */
export function getRecoveryHints(errorCode: ErrorCode): string[] {
  switch (errorCode) {
    case 'MATCH_NOT_FOUND':
      return [
        'Check for whitespace differences between old_string and file content',
        'Re-read the file to see its current content before retrying',
      ];
    case 'AMBIGUOUS_MATCH':
      return [
        'Use replace_all: true to replace all occurrences',
        'Make old_string more specific to match only the intended location',
      ];
    case 'FILE_NOT_FOUND':
      return ['Check that the file path is correct and the file exists'];
    case 'PERMISSION_DENIED':
      return ['Check file permissions or run with appropriate access'];
    case 'VALIDATION_FAILED':
      return ['Check input format matches the tool schema'];
    case 'RELATIVE_PATH':
      return ['Provide an absolute file path starting with /'];
    case 'PATH_TRAVERSAL':
      return ['Remove .. segments from the file path'];
    case 'EMPTY_EDITS':
      return ['Provide at least one edit operation in the edits array'];
    case 'EMPTY_OLD_STRING':
      return ['Each edit must have a non-empty old_string'];
    case 'DUPLICATE_OLD_STRING':
      return [
        'Each edit must have a unique old_string',
        'Combine edits or make old_strings more specific',
      ];
    case 'DUPLICATE_FILE_PATH':
      return [
        'Remove duplicate file paths from the files array',
        'Each file should appear only once',
      ];
    case 'INVALID_ENCODING':
      return ['Ensure the file uses UTF-8 encoding'];
    case 'DISK_FULL':
      return ['Free up disk space and retry'];
    case 'READ_ONLY_FS':
      return ['Check that the file system is writable'];
    case 'SYMLINK_LOOP':
      return ['Check for circular symlinks in the file path'];
    case 'BACKUP_FAILED':
      return ['Check write permissions for the backup file location', 'Use backup: false to skip backup creation'];
    case 'WRITE_FAILED':
      return ['Check write permissions for the target file'];
    case 'UNKNOWN_TOOL':
      return ['Check the tool name matches a supported tool'];
    case 'NOT_IMPLEMENTED':
      return ['This feature is not yet available'];
    default:
      return ['Check error details and retry'];
  }
}

/**
 * Extract file context for match-not-found errors
 * Returns 10-15 lines of raw content, no line numbers
 */
export function extractFileContext(
  fileContent: string,
  searchString: string
): ErrorContext {
  if (!fileContent || fileContent.length === 0) {
    return {};
  }

  const lines = fileContent.split('\n');

  // Try partial match with progressively shorter prefixes
  const prefixLengths = [20, 10, 5];
  for (const prefixLen of prefixLengths) {
    if (searchString.length < prefixLen) continue;

    const prefix = searchString.slice(0, prefixLen);
    const matchIndex = fileContent.indexOf(prefix);

    if (matchIndex !== -1) {
      // Find the line number of the match
      const beforeMatch = fileContent.substring(0, matchIndex);
      const matchLine = beforeMatch.split('\n').length - 1; // 0-based line index

      // Extract 7 lines before and 7 lines after (14 lines total)
      const startLine = Math.max(0, matchLine - 7);
      const endLine = Math.min(lines.length, matchLine + 8); // +8 because slice end is exclusive
      const contextLines = lines.slice(startLine, endLine);

      return { snippet: contextLines.join('\n') };
    }
  }

  // Also try with shorter prefix if searchString is shorter than 5 chars
  if (searchString.length > 0 && searchString.length < 5) {
    const matchIndex = fileContent.indexOf(searchString.slice(0, searchString.length));
    if (matchIndex !== -1) {
      const beforeMatch = fileContent.substring(0, matchIndex);
      const matchLine = beforeMatch.split('\n').length - 1;
      const startLine = Math.max(0, matchLine - 7);
      const endLine = Math.min(lines.length, matchLine + 8);
      const contextLines = lines.slice(startLine, endLine);
      return { snippet: contextLines.join('\n') };
    }
  }

  // No partial match found: return first 15 lines of file
  const contextLines = lines.slice(0, 15);
  return { snippet: contextLines.join('\n') };
}

/**
 * Extract match locations for ambiguous-match errors
 * Shows ALL match locations with surrounding context (3 lines before/after)
 * Caps at 5 locations with a note if more exist
 */
export function extractMatchLocations(
  fileContent: string,
  searchString: string,
  positions: number[]
): ErrorContext {
  if (positions.length === 0) {
    return {};
  }

  const lines = fileContent.split('\n');
  const totalMatches = positions.length;
  const displayPositions = positions.slice(0, 5);

  const matchLocations: MatchLocation[] = displayPositions.map(pos => {
    // Find the line number (1-based)
    const beforeMatch = fileContent.substring(0, pos);
    const lineIndex = beforeMatch.split('\n').length - 1; // 0-based
    const lineNumber = lineIndex + 1; // 1-based

    // Extract 3 lines before and 3 lines after (7 lines per location)
    const startLine = Math.max(0, lineIndex - 3);
    const endLine = Math.min(lines.length, lineIndex + 4); // +4 because slice end is exclusive
    const contextLines = lines.slice(startLine, endLine);

    return {
      line: lineNumber,
      snippet: contextLines.join('\n'),
    };
  });

  const result: ErrorContext = { match_locations: matchLocations };

  if (totalMatches > 5) {
    result.snippet = `5 of ${totalMatches} matches shown`;
  }

  return result;
}

/**
 * Create a canonical error envelope
 * Omits undefined fields from the result
 */
export function createErrorEnvelope(opts: {
  error_code: ErrorCode;
  message: string;
  file_path?: string;
  edit_index?: number;
  recovery_hints?: string[];
  context?: ErrorContext;
  edit_status?: EditStatusEntry[];
  backup_path?: string;
}): ErrorEnvelope {
  const envelope: ErrorEnvelope = {
    success: false,
    error_code: opts.error_code,
    message: opts.message,
    retryable: isRetryable(opts.error_code),
    recovery_hints: opts.recovery_hints ?? getRecoveryHints(opts.error_code),
  };

  if (opts.file_path !== undefined) {
    envelope.file_path = opts.file_path;
  }
  if (opts.edit_index !== undefined) {
    envelope.edit_index = opts.edit_index;
  }
  if (opts.context !== undefined) {
    envelope.context = opts.context;
  }
  if (opts.edit_status !== undefined) {
    envelope.edit_status = opts.edit_status;
  }
  if (opts.backup_path !== undefined) {
    envelope.backup_path = opts.backup_path;
  }

  return envelope;
}

/**
 * Build per-edit status array
 * Only lists failed/skipped edits - absence means success
 */
export function buildEditStatus(
  edits: Array<{ old_string: string }>,
  failedIndex: number,
  failedCode: ErrorCode,
  failedMessage: string
): EditStatusEntry[] {
  const status: EditStatusEntry[] = [];

  // The failed edit
  status.push({
    edit_index: failedIndex,
    status: 'failed',
    error_code: failedCode,
    message: failedMessage,
    old_string_preview: edits[failedIndex].old_string.slice(0, 40),
  });

  // Subsequent edits are skipped
  for (let i = failedIndex + 1; i < edits.length; i++) {
    status.push({
      edit_index: i,
      status: 'skipped',
      old_string_preview: edits[i].old_string.slice(0, 40),
    });
  }

  return status;
}
