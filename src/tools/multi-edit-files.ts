/**
 * multi_edit_files tool handler
 *
 * Perform coordinated edits across multiple files atomically.
 */

import { applyEdits } from '../core/editor.js';
import { validateMultiEditFilesInput, isAbsolutePath } from '../core/validator.js';
import {
  formatMultiEditFilesResult,
  createFilesErrorResult,
  createFilesSuccessResult,
} from '../core/reporter.js';
import type { MultiEditFilesInput, MultiEditResult } from '../types/index.js';

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
    const errorMessage = validation.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: `Validation failed: ${errorMessage}` }) }],
      isError: true,
    };
  }

  const input = validation.data as MultiEditFilesInput;

  // Validate all paths are absolute
  for (let i = 0; i < input.files.length; i++) {
    if (!isAbsolutePath(input.files[i].file_path)) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: `files[${i}].file_path must be an absolute path`,
          }),
        }],
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
          input.create_backup
        );

        results.push(result);

        if (!result.success) {
          // If any file fails, report error
          const errorResult = createFilesErrorResult(
            `Failed to edit file ${fileEdit.file_path}: ${result.error}`,
            i,
            results
          );
          return {
            content: [{ type: 'text', text: formatMultiEditFilesResult(errorResult) }],
            isError: true,
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const errorResult = createFilesErrorResult(
          `Error editing file ${fileEdit.file_path}: ${message}`,
          i,
          results
        );
        return {
          content: [{ type: 'text', text: formatMultiEditFilesResult(errorResult) }],
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    const errorResult = createFilesErrorResult(message);
    return {
      content: [{ type: 'text', text: formatMultiEditFilesResult(errorResult) }],
      isError: true,
    };
  }
}
