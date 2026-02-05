/**
 * multi_edit tool handler
 *
 * Perform multiple find-and-replace operations on a single file atomically.
 */

import { applyEdits } from '../core/editor.js';
import { validateMultiEditInput, isAbsolutePath } from '../core/validator.js';
import { formatMultiEditResult, createErrorResult } from '../core/reporter.js';
import type { MultiEditInput, MultiEditResult } from '../types/index.js';

/**
 * Handle multi_edit tool call
 */
export async function handleMultiEdit(args: unknown): Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}> {
  // Validate input
  const validation = validateMultiEditInput(args);
  if (!validation.success) {
    const errorMessage = validation.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: `Validation failed: ${errorMessage}` }) }],
      isError: true,
    };
  }

  const input = validation.data as MultiEditInput;

  // Validate absolute path
  if (!isAbsolutePath(input.file_path)) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'file_path must be an absolute path' }) }],
      isError: true,
    };
  }

  try {
    // Apply edits
    const result = await applyEdits(
      input.file_path,
      input.edits,
      input.dry_run,
      input.create_backup
    );

    return {
      content: [{ type: 'text', text: formatMultiEditResult(result) }],
      isError: !result.success,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const result = createErrorResult(input.file_path, message);
    return {
      content: [{ type: 'text', text: formatMultiEditResult(result) }],
      isError: true,
    };
  }
}
