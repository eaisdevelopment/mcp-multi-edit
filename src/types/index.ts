/**
 * Type definitions for EAIS MCP Multi-Edit Server
 */

/**
 * Single edit operation
 */
export interface EditOperation {
  /** Text to find in the file */
  old_string: string;
  /** Text to replace with */
  new_string: string;
  /** Replace all occurrences (default: false) */
  replace_all?: boolean;
}

/**
 * Input for multi_edit tool
 */
export interface MultiEditInput {
  /** Absolute path to the file */
  file_path: string;
  /** Array of edit operations to apply */
  edits: EditOperation[];
  /** Preview changes without applying (default: false) */
  dry_run?: boolean;
  /** Create backup file before editing (default: false) */
  create_backup?: boolean;
}

/**
 * Input for multi_edit_files tool
 */
export interface MultiEditFilesInput {
  /** Array of file edit operations */
  files: Array<{
    file_path: string;
    edits: EditOperation[];
  }>;
  /** Preview changes without applying (default: false) */
  dry_run?: boolean;
  /** Create backup files before editing (default: false) */
  create_backup?: boolean;
}

/**
 * Result of a single edit operation
 */
export interface EditResult {
  /** The old_string that was searched for */
  old_string: string;
  /** Number of matches found */
  matches: number;
  /** Number of replacements made */
  replaced: number;
  /** Whether this edit was successful */
  success: boolean;
  /** Error message if edit failed */
  error?: string;
}

/**
 * Result of multi_edit operation
 */
export interface MultiEditResult {
  /** Whether all edits succeeded */
  success: boolean;
  /** Path to the edited file */
  file_path: string;
  /** Number of edits applied */
  edits_applied: number;
  /** Results for each edit operation */
  results: EditResult[];
  /** Overall error message if operation failed */
  error?: string;
  /** Index of the failed edit (if any) */
  failed_edit_index?: number;
  /** Whether this was a dry run */
  dry_run: boolean;
  /** Path to backup file (if created) */
  backup_path?: string;
}

/**
 * Result of multi_edit_files operation
 */
export interface MultiEditFilesResult {
  /** Whether all file edits succeeded */
  success: boolean;
  /** Number of files edited */
  files_edited: number;
  /** Results for each file */
  file_results: MultiEditResult[];
  /** Overall error message if operation failed */
  error?: string;
  /** Index of the failed file (if any) */
  failed_file_index?: number;
  /** Whether this was a dry run */
  dry_run: boolean;
}
