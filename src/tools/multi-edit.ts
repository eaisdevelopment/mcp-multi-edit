/**
 * multi_edit tool handler
 *
 * Perform multiple find-and-replace operations on a single file atomically.
 */

import { readFile } from 'node:fs/promises';
import { applyEdits } from '../core/editor.js';
import { validateMultiEditInputFull } from '../core/validator.js';
import { formatMultiEditResponse } from '../core/reporter.js';
import { createErrorEnvelope, classifyError } from '../core/errors.js';

/**
 * Handle multi_edit tool call
 */
export async function handleMultiEdit(args: unknown): Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}> {
  // Validate input using full layered validation
  const validation = await validateMultiEditInputFull(args);
  if (!validation.success) {
    const envelope = createErrorEnvelope({
      error_code: 'VALIDATION_FAILED',
      message: 'Input validation failed',
      recovery_hints: validation.errors.map(e => `${e.code}: ${e.message} (${e.recovery_hint})`),
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
      isError: true,
    };
  }

  const input = validation.data;
  // Note: file_path is now resolved (symlinks followed) and guaranteed to exist

  // Read file content for context snippets in error responses
  // File is guaranteed to exist after validation passes
  const fileContent = await readFile(input.file_path, 'utf-8');

  try {
    // Apply edits
    const result = await applyEdits(
      input.file_path,
      input.edits,
      input.dry_run,
      input.backup
    );

    const response = formatMultiEditResponse(
      result,
      input.include_content ?? false,
      input.edits.length,
      fileContent,
      fileContent,  // Pass as originalContent - safe because file not modified when dry_run=true
      input.edits   // Pass edits for per-edit status in ErrorEnvelope
    );

    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
      isError: !result.success,
    };
  } catch (error) {
    const classified = classifyError(error, input.file_path);
    const envelope = createErrorEnvelope({
      error_code: classified.error_code,
      message: classified.message,
      file_path: input.file_path,
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
      isError: true,
    };
  }
}
