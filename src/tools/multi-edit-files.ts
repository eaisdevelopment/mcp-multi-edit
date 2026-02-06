/**
 * multi_edit_files tool handler
 *
 * Perform coordinated edits across multiple files atomically.
 */

import { applyEdits } from '../core/editor.js';
import { validateMultiEditFilesInput, isAbsolutePath } from '../core/validator.js';
import {
  formatMultiEditFilesResult,
  createFilesSuccessResult,
} from '../core/reporter.js';
import { createErrorEnvelope, classifyError } from '../core/errors.js';
import type { MultiEditFilesInput, MultiEditResult, ErrorCode } from '../types/index.js';

/**
 * Classify error code from a result error message string
 */
function classifyErrorCodeFromMessage(errorMessage: string): ErrorCode {
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
 * Handle multi_edit_files tool call
 */
export async function handleMultiEditFiles(args: unknown): Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}> {
  // Validate input
  const validation = validateMultiEditFilesInput(args);
  if (!validation.success) {
    const errorMessages = validation.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    const envelope = createErrorEnvelope({
      error_code: 'VALIDATION_FAILED',
      message: `Validation failed: ${errorMessages}`,
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
      isError: true,
    };
  }

  const input = validation.data as MultiEditFilesInput;

  // Validate all paths are absolute
  for (let i = 0; i < input.files.length; i++) {
    if (!isAbsolutePath(input.files[i].file_path)) {
      const envelope = createErrorEnvelope({
        error_code: 'RELATIVE_PATH',
        message: `files[${i}].file_path must be an absolute path`,
        file_path: input.files[i].file_path,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
        isError: true,
      };
    }
  }

  try {
    const results: MultiEditResult[] = [];
    const originalContents: Map<string, string> = new Map();

    // For atomic operation, we need to:
    // 1. Read all files first
    // 2. Apply all edits in memory
    // 3. Write all files only if all succeed

    // TODO: Implement atomic multi-file editing
    // For now, apply sequentially (non-atomic)

    for (let i = 0; i < input.files.length; i++) {
      const fileEdit = input.files[i];

      try {
        const result = await applyEdits(
          fileEdit.file_path,
          fileEdit.edits,
          input.dry_run,
          input.backup
        );

        results.push(result);

        if (!result.success) {
          // If any file fails, report error with classified error code
          const errorCode = classifyErrorCodeFromMessage(result.error || '');
          const envelope = createErrorEnvelope({
            error_code: errorCode,
            message: `Failed to edit file ${fileEdit.file_path}: ${result.error}`,
            file_path: fileEdit.file_path,
            edit_index: i,
          });
          return {
            content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
            isError: true,
          };
        }
      } catch (error) {
        const classified = classifyError(error, fileEdit.file_path);
        const envelope = createErrorEnvelope({
          error_code: classified.error_code,
          message: `Error editing file ${fileEdit.file_path}: ${classified.message}`,
          file_path: fileEdit.file_path,
          edit_index: i,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
          isError: true,
        };
      }
    }

    const successResult = createFilesSuccessResult(results, input.dry_run ?? false);
    return {
      content: [{ type: 'text', text: formatMultiEditFilesResult(successResult) }],
      isError: false,
    };
  } catch (error) {
    const classified = classifyError(error);
    const envelope = createErrorEnvelope({
      error_code: classified.error_code,
      message: classified.message,
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
      isError: true,
    };
  }
}
