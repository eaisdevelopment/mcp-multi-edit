/**
 * Unit tests for reporter.ts formatting functions
 *
 * Tests exported functions directly with static imports.
 * No filesystem mocking needed.
 */

import { describe, it, expect } from 'vitest';
import {
  formatMultiEditResponse,
  generateDiffPreview,
  truncateForDisplay,
  formatMultiEditFilesResponse,
  createFilesSuccessResult,
} from '../../src/core/reporter.js';
import type { SuccessResponse } from '../../src/core/reporter.js';
import type { MultiEditResult, MultiEditFilesResult, ErrorEnvelope } from '../../src/types/index.js';

// Helper to create a successful MultiEditResult
function makeSuccessResult(overrides: Partial<MultiEditResult> = {}): MultiEditResult {
  return {
    success: true,
    file_path: '/tmp/test.txt',
    edits_applied: 1,
    results: [
      { old_string: 'old', matches: 1, replaced: 1, success: true },
    ],
    dry_run: false,
    ...overrides,
  };
}

// Helper to create a failed MultiEditResult
function makeErrorResult(overrides: Partial<MultiEditResult> = {}): MultiEditResult {
  return {
    success: false,
    file_path: '/tmp/test.txt',
    edits_applied: 0,
    results: [
      { old_string: 'not_found_text', matches: 0, replaced: 0, success: false, error: 'old_string not found in file' },
    ],
    error: 'old_string not found in file',
    failed_edit_index: 0,
    dry_run: false,
    ...overrides,
  };
}

describe('truncateForDisplay', () => {
  it('should return string unchanged when shorter than maxLen', () => {
    expect(truncateForDisplay('hello', 10)).toBe('hello');
  });

  it('should return string unchanged when exactly maxLen', () => {
    expect(truncateForDisplay('hello', 5)).toBe('hello');
  });

  it('should truncate with ellipsis when longer than maxLen', () => {
    const result = truncateForDisplay('hello world', 8);
    expect(result).toBe('hello...');
    expect(result.length).toBe(8);
  });
});

describe('generateDiffPreview', () => {
  it('should return "No changes" when content is identical', () => {
    const result = generateDiffPreview('same content', 'same content', '/file.txt');
    expect(result).toBe('No changes');
  });

  it('should show changed line with diff markers', () => {
    const result = generateDiffPreview('old line', 'new line', '/file.txt');
    expect(result).toContain('--- /file.txt (original)');
    expect(result).toContain('+++ /file.txt (modified)');
    expect(result).toContain('L1: - old line');
    expect(result).toContain('L1: + new line');
  });

  it('should show added lines when newContent has more lines', () => {
    const result = generateDiffPreview('line1', 'line1\nline2', '/file.txt');
    // Line 2 is added (origLine is undefined, newLine is 'line2')
    expect(result).toContain('L2: + line2');
    // Line 1 is unchanged so should not appear in diff
    expect(result).not.toContain('L1:');
  });

  it('should show removed lines when originalContent has more lines', () => {
    const result = generateDiffPreview('line1\nline2', 'line1', '/file.txt');
    expect(result).toContain('L2: - line2');
  });
});

describe('formatMultiEditResponse - success paths', () => {
  it('should return SuccessResponse with edits array', () => {
    const result = makeSuccessResult();
    const response = formatMultiEditResponse(result, false, 1) as SuccessResponse;

    expect(response.success).toBe(true);
    expect(response.file_path).toBe('/tmp/test.txt');
    expect(response.edits_applied).toBe(1);
    expect(response.dry_run).toBe(false);
    expect(response.edits).toHaveLength(1);
    expect(response.edits[0].old_string).toBe('old');
    expect(response.edits[0].matched).toBe(true);
    expect(response.edits[0].occurrences_replaced).toBe(1);
  });

  it('should include DRY RUN message and diff_preview for dry_run', () => {
    const result = makeSuccessResult({
      dry_run: true,
      final_content: 'new content',
    });
    const response = formatMultiEditResponse(
      result, false, 1, undefined, 'old content'
    ) as SuccessResponse;

    expect(response.message).toBe('DRY RUN - No changes made to file');
    expect(response.diff_preview).toBeDefined();
    expect(response.diff_preview).toContain('--- /tmp/test.txt (original)');
  });

  it('should include final_content when includeContent=true', () => {
    const result = makeSuccessResult({
      final_content: 'new content here',
    });
    const response = formatMultiEditResponse(result, true, 1) as SuccessResponse;
    expect(response.final_content).toBe('new content here');
  });

  it('should not include final_content when includeContent=false', () => {
    const result = makeSuccessResult({
      final_content: 'new content here',
    });
    const response = formatMultiEditResponse(result, false, 1) as SuccessResponse;
    expect(response.final_content).toBeUndefined();
  });

  it('should include backup_path when present', () => {
    const result = makeSuccessResult({
      backup_path: '/tmp/test.txt.bak',
    });
    const response = formatMultiEditResponse(result, false, 1) as SuccessResponse;
    expect(response.backup_path).toBe('/tmp/test.txt.bak');
  });
});

describe('formatMultiEditResponse - error paths', () => {
  it('should produce MATCH_NOT_FOUND ErrorEnvelope with context snippet', () => {
    const result = makeErrorResult();
    const fileContent = 'line1\nline2\nline3\nline4\nline5';
    const response = formatMultiEditResponse(result, false, 1, fileContent) as ErrorEnvelope;

    expect(response.success).toBe(false);
    expect(response.error_code).toBe('MATCH_NOT_FOUND');
    expect(response.message).toContain('Edit 1 of 1 failed');
    expect(response.context).toBeDefined();
    expect(response.context!.snippet).toBeDefined();
  });

  it('should produce AMBIGUOUS_MATCH ErrorEnvelope with match_locations', () => {
    // fileContent has 'duplicate' appearing twice
    const fileContent = 'line1\nduplicate here\nline3\nduplicate again\nline5';
    const result = makeErrorResult({
      error: '2 matches at lines 2, 4',
      results: [
        { old_string: 'duplicate', matches: 2, replaced: 0, success: false, error: '2 matches at lines 2, 4' },
      ],
    });
    const response = formatMultiEditResponse(result, false, 1, fileContent) as ErrorEnvelope;

    expect(response.error_code).toBe('AMBIGUOUS_MATCH');
    expect(response.context).toBeDefined();
    expect(response.context!.match_locations).toBeDefined();
    expect(response.context!.match_locations!.length).toBe(2);
  });

  it('should produce PERMISSION_DENIED ErrorEnvelope', () => {
    const result = makeErrorResult({
      error: 'permission denied eacces',
      results: [
        { old_string: 'text', matches: 0, replaced: 0, success: false, error: 'permission denied eacces' },
      ],
    });
    const response = formatMultiEditResponse(result, false, 1) as ErrorEnvelope;
    expect(response.error_code).toBe('PERMISSION_DENIED');
  });

  it('should produce INVALID_ENCODING ErrorEnvelope', () => {
    const result = makeErrorResult({
      error: 'invalid utf-8 encoding',
      results: [
        { old_string: 'text', matches: 0, replaced: 0, success: false, error: 'invalid utf-8 encoding' },
      ],
    });
    const response = formatMultiEditResponse(result, false, 1) as ErrorEnvelope;
    expect(response.error_code).toBe('INVALID_ENCODING');
  });

  it('should produce BACKUP_FAILED ErrorEnvelope', () => {
    const result = makeErrorResult({
      error: 'backup failed',
      results: [
        { old_string: 'text', matches: 0, replaced: 0, success: false, error: 'backup failed' },
      ],
    });
    const response = formatMultiEditResponse(result, false, 1) as ErrorEnvelope;
    expect(response.error_code).toBe('BACKUP_FAILED');
  });

  it('should produce UNKNOWN_ERROR ErrorEnvelope for unrecognized message', () => {
    const result = makeErrorResult({
      error: 'something completely unknown',
      results: [
        { old_string: 'text', matches: 0, replaced: 0, success: false, error: 'something completely unknown' },
      ],
    });
    const response = formatMultiEditResponse(result, false, 1) as ErrorEnvelope;
    expect(response.error_code).toBe('UNKNOWN_ERROR');
  });

  it('should include edit_status when edits param provided', () => {
    const result = makeErrorResult();
    const edits = [{ old_string: 'not_found_text' }, { old_string: 'another' }];
    const response = formatMultiEditResponse(result, false, 2, undefined, undefined, edits) as ErrorEnvelope;

    expect(response.edit_status).toBeDefined();
    expect(response.edit_status!.length).toBe(2);
    expect(response.edit_status![0].status).toBe('failed');
    expect(response.edit_status![1].status).toBe('skipped');
  });

  it('should have no context when fileContent is not provided', () => {
    const result = makeErrorResult();
    const response = formatMultiEditResponse(result, false, 1) as ErrorEnvelope;
    // context is undefined because no fileContent was given
    expect('context' in response).toBe(false);
  });

  it('should use "Unknown error" when result.error is undefined', () => {
    const result = makeErrorResult({
      error: undefined,
    });
    const response = formatMultiEditResponse(result, false, 1) as ErrorEnvelope;
    expect(response.message).toContain('Unknown error');
  });
});

describe('formatMultiEditFilesResponse', () => {
  const makeFilesResult = (): MultiEditFilesResult => ({
    success: true,
    files_edited: 1,
    file_results: [
      {
        success: true,
        file_path: '/tmp/a.txt',
        edits_applied: 1,
        results: [{ old_string: 'old', matches: 1, replaced: 1, success: true }],
        dry_run: false,
        final_content: 'new content',
      },
    ],
    dry_run: false,
  });

  it('should strip final_content when includeContent=false', () => {
    const result = makeFilesResult();
    const json = formatMultiEditFilesResponse(result, false);
    const parsed = JSON.parse(json);
    expect(parsed.file_results[0].final_content).toBeUndefined();
  });

  it('should preserve final_content when includeContent=true', () => {
    const result = makeFilesResult();
    const json = formatMultiEditFilesResponse(result, true);
    const parsed = JSON.parse(json);
    expect(parsed.file_results[0].final_content).toBe('new content');
  });
});

describe('createFilesSuccessResult', () => {
  it('should populate summary with correct counts', () => {
    const fileResults: MultiEditResult[] = [
      {
        success: true,
        file_path: '/tmp/a.txt',
        edits_applied: 2,
        results: [],
        dry_run: false,
      },
      {
        success: false,
        file_path: '/tmp/b.txt',
        edits_applied: 0,
        results: [],
        dry_run: false,
        error: 'failed',
      },
      {
        success: true,
        file_path: '/tmp/c.txt',
        edits_applied: 3,
        results: [],
        dry_run: false,
      },
    ];

    const result = createFilesSuccessResult(fileResults, false);

    expect(result.success).toBe(true);
    expect(result.files_edited).toBe(3);
    expect(result.summary).toBeDefined();
    expect(result.summary!.total_files).toBe(3);
    expect(result.summary!.files_succeeded).toBe(2);
    expect(result.summary!.files_failed).toBe(1);
    expect(result.summary!.total_edits).toBe(5);
    expect(result.dry_run).toBe(false);
  });
});
