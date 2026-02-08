/**
 * multi_edit_files tool handler
 *
 * Perform coordinated edits across multiple files atomically.
 * Uses a 3-phase pipeline: validate-all, backup+edit (fail-fast), rollback on failure.
 */

import {
  readFileValidated,
  applyEditsToContent,
  atomicWrite,
  createBackup,
} from '../core/editor.js';
import { validateMultiEditFilesInputFull } from '../core/validator.js';
import {
  formatMultiEditFilesResponse,
  createFilesSuccessResult,
  generateDiffPreview,
} from '../core/reporter.js';
import { createErrorEnvelope, classifyError } from '../core/errors.js';
import type {
  MultiEditResult,
  MultiEditFilesInput,
  ErrorCode,
  RollbackReport,
  RollbackDetail,
} from '../types/index.js';

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

/** Track a file that was written to disk and can be rolled back */
interface WrittenFile {
  file_path: string;
  backup_path: string;
}

/**
 * Roll back written files by restoring from .bak backups.
 * Iterates in REVERSE order. Continues even if individual rollbacks fail.
 */
async function rollbackFiles(writtenFiles: WrittenFile[]): Promise<RollbackReport> {
  const details: RollbackDetail[] = [];
  let filesRolledBack = 0;
  let filesFailedRollback = 0;

  // Reverse order for rollback
  for (let i = writtenFiles.length - 1; i >= 0; i--) {
    const { file_path, backup_path } = writtenFiles[i];
    try {
      const backupContent = await readFileValidated(backup_path);
      await atomicWrite(file_path, backupContent);
      details.push({ file_path, status: 'restored', backup_path });
      filesRolledBack++;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown rollback error';
      details.push({ file_path, status: 'failed', backup_path, error: errMsg });
      filesFailedRollback++;
    }
  }

  return {
    files_rolled_back: filesRolledBack,
    files_failed_rollback: filesFailedRollback,
    details,
  };
}

/**
 * Handle multi_edit_files tool call
 *
 * 3-Phase Pipeline:
 *   Phase A: Validate all files upfront
 *   Phase B: Backup + Edit with fail-fast
 *   Phase C: Rollback on failure (restore from .bak)
 */
export async function handleMultiEditFiles(args: unknown): Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}> {
  // ==============================
  // Phase A: Validate All Upfront
  // ==============================

  const validation = await validateMultiEditFilesInputFull(args);
  if (!validation.success) {
    const recoveryHints = validation.errors.map(
      e => `${e.code}: ${e.message} (${e.recovery_hint})`
    );
    const envelope = createErrorEnvelope({
      error_code: 'VALIDATION_FAILED',
      message: `Validation failed with ${validation.errors.length} error(s)`,
      recovery_hints: recoveryHints,
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
      isError: true,
    };
  }

  const input: MultiEditFilesInput = validation.data;
  const dryRun = input.dry_run ?? false;
  const includeContent = input.include_content ?? false;
  const totalFiles = input.files.length;

  // ==============================
  // Phase B: Backup + Edit (fail-fast)
  // ==============================

  // Per CONTEXT: backup param is IGNORED for multi-file - always create backups
  const writtenFiles: WrittenFile[] = [];
  const fileResults: MultiEditResult[] = [];

  try {
    for (let i = 0; i < totalFiles; i++) {
      const fileEdit = input.files[i];

      // B1. Read file content
      let content: string;
      try {
        content = await readFileValidated(fileEdit.file_path);
      } catch (readError) {
        // Read failure -> rollback previously written files
        const rollbackReport = writtenFiles.length > 0
          ? await rollbackFiles(writtenFiles)
          : undefined;

        const classified = classifyError(readError, fileEdit.file_path);
        const envelope = createErrorEnvelope({
          error_code: classified.error_code,
          message: `Edit failed in file ${i + 1} of ${totalFiles}: ${classified.message}`,
          file_path: fileEdit.file_path,
        });

        // Build per-file status array
        const fileStatuses = buildFileStatuses(fileResults, i, totalFiles, classified.message, input.files);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ...envelope,
              rollback: rollbackReport,
              file_statuses: fileStatuses,
            }, null, 2),
          }],
          isError: true,
        };
      }

      // B2. Create mandatory backup
      let backupPath: string;
      try {
        backupPath = await createBackup(fileEdit.file_path, content);
      } catch (backupError) {
        // Backup failure -> rollback
        const rollbackReport = writtenFiles.length > 0
          ? await rollbackFiles(writtenFiles)
          : undefined;

        const envelope = createErrorEnvelope({
          error_code: 'BACKUP_FAILED',
          message: `Edit failed in file ${i + 1} of ${totalFiles}: Backup failed for ${fileEdit.file_path}`,
          file_path: fileEdit.file_path,
        });

        const fileStatuses = buildFileStatuses(fileResults, i, totalFiles, 'Backup failed', input.files);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ...envelope,
              rollback: rollbackReport,
              file_statuses: fileStatuses,
            }, null, 2),
          }],
          isError: true,
        };
      }

      // B3. Apply edits in memory
      const editResult = applyEditsToContent(fileEdit.file_path, content, fileEdit.edits, dryRun);
      editResult.backup_path = backupPath;

      if (!editResult.success) {
        // Edit failure -> rollback
        const rollbackReport = writtenFiles.length > 0
          ? await rollbackFiles(writtenFiles)
          : undefined;

        const errorCode = classifyErrorCodeFromMessage(editResult.error || '');
        const envelope = createErrorEnvelope({
          error_code: errorCode,
          message: `Edit failed in file ${i + 1} of ${totalFiles}: ${editResult.error}`,
          file_path: fileEdit.file_path,
        });

        const fileStatuses = buildFileStatuses(fileResults, i, totalFiles, editResult.error || 'Edit failed', input.files);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ...envelope,
              rollback: rollbackReport,
              file_statuses: fileStatuses,
            }, null, 2),
          }],
          isError: true,
        };
      }

      // B4. If NOT dry_run: write to disk
      if (!dryRun) {
        try {
          await atomicWrite(fileEdit.file_path, editResult.final_content!);
          writtenFiles.push({ file_path: fileEdit.file_path, backup_path: backupPath });
        } catch (writeError) {
          // Write failure -> rollback
          const rollbackReport = writtenFiles.length > 0
            ? await rollbackFiles(writtenFiles)
            : undefined;

          const classified = classifyError(writeError, fileEdit.file_path);
          const envelope = createErrorEnvelope({
            error_code: classified.error_code,
            message: `Edit failed in file ${i + 1} of ${totalFiles}: ${classified.message}`,
            file_path: fileEdit.file_path,
          });

          const fileStatuses = buildFileStatuses(fileResults, i, totalFiles, classified.message, input.files);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                ...envelope,
                rollback: rollbackReport,
                file_statuses: fileStatuses,
              }, null, 2),
            }],
            isError: true,
          };
        }
      }

      // B5. Add dry-run specific fields
      if (dryRun) {
        (editResult as MultiEditResult & { message?: string; diff_preview?: string }).message =
          'DRY RUN - No changes made';
        if (editResult.final_content) {
          (editResult as MultiEditResult & { diff_preview?: string }).diff_preview =
            generateDiffPreview(content, editResult.final_content, fileEdit.file_path);
        }
      }

      // B6. Track result
      fileResults.push(editResult);
    }
  } catch (error) {
    // Unexpected exception -> rollback
    const rollbackReport = writtenFiles.length > 0
      ? await rollbackFiles(writtenFiles)
      : undefined;

    const classified = classifyError(error);
    const envelope = createErrorEnvelope({
      error_code: classified.error_code,
      message: classified.message,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ...envelope,
          rollback: rollbackReport,
        }, null, 2),
      }],
      isError: true,
    };
  }

  // ==============================
  // Success: All files edited
  // ==============================

  const successResult = createFilesSuccessResult(fileResults, dryRun);
  const responseText = formatMultiEditFilesResponse(successResult, includeContent);

  return {
    content: [{ type: 'text', text: responseText }],
    isError: false,
  };
}

/**
 * Build per-file status array for error responses.
 * Files before failedIndex are 'succeeded' (written then rolled back),
 * the failedIndex file is 'failed',
 * files after failedIndex are 'skipped'.
 */
function buildFileStatuses(
  completedResults: MultiEditResult[],
  failedIndex: number,
  totalFiles: number,
  errorMessage: string,
  files: Array<{ file_path: string }>
): Array<{ file_path: string; status: string; error?: string }> {
  const statuses: Array<{ file_path: string; status: string; error?: string }> = [];

  // Succeeded files (will be rolled back)
  for (let j = 0; j < completedResults.length; j++) {
    statuses.push({
      file_path: files[j].file_path,
      status: 'rolled_back',
    });
  }

  // Failed file
  statuses.push({
    file_path: files[failedIndex].file_path,
    status: 'failed',
    error: errorMessage,
  });

  // Skipped files
  for (let j = failedIndex + 1; j < totalFiles; j++) {
    statuses.push({
      file_path: files[j].file_path,
      status: 'skipped',
    });
  }

  return statuses;
}
