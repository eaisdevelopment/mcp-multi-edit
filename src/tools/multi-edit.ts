/**
 * multi_edit tool handler
 *
 * Perform multiple find-and-replace operations on a single file atomically.
 */

import { readFile } from 'node:fs/promises';
import { applyEdits } from '../core/editor.js';
import { validateMultiEditInputFull } from '../core/validator.js';
import { formatMultiEditResponse, createErrorResult } from '../core/reporter.js';

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
    const errorMessages = validation.errors.map(e =>
      `${e.code}: ${e.message} (Hint: ${e.recovery_hint})`
    ).join('\n');
    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: false,
        error: 'Validation failed',
        errors: validation.errors,
        message: errorMessages
      }, null, 2) }],
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
      input.create_backup
    );

    const response = formatMultiEditResponse(
      result,
      input.include_content ?? false,
      input.edits.length,
      fileContent
    );

    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
      isError: !result.success,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const result = createErrorResult(input.file_path, message);
    const response = formatMultiEditResponse(
      result,
      false,
      input.edits.length,
      fileContent
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
      isError: true,
    };
  }
}
