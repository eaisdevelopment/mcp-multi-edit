/**
 * multi_edit tool handler
 *
 * Perform multiple find-and-replace operations on a single file atomically.
 */

import { readFile } from 'node:fs/promises';
import { applyEdits } from '../core/editor.js';
import { validateMultiEditInput, isAbsolutePath } from '../core/validator.js';
import { formatMultiEditResponse, createErrorResult } from '../core/reporter.js';
import type { MultiEditInput } from '../types/index.js';

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

  // Read file content for context snippets in error responses
  let fileContent: string | undefined;
  try {
    fileContent = await readFile(input.file_path, 'utf-8');
  } catch {
    // File read error will be handled by applyEdits
  }

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
