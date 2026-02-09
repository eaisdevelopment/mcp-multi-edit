/**
 * Unit tests for errors.ts pure functions
 *
 * Tests pure (non-IO) functions directly with static imports.
 * No filesystem mocking needed.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyError,
  getRecoveryHints,
  extractFileContext,
  extractMatchLocations,
  buildEditStatus,
  createErrorEnvelope,
  isRetryable,
  RETRYABLE_CODES,
} from '../../src/core/errors.js';

describe('classifyError', () => {
  it('should classify ENOENT as FILE_NOT_FOUND', () => {
    const error = Object.assign(new Error('no such file'), { code: 'ENOENT' });
    const result = classifyError(error);
    expect(result.error_code).toBe('FILE_NOT_FOUND');
    expect(result.message).toBe('no such file');
  });

  it('should classify EACCES as PERMISSION_DENIED', () => {
    const error = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    const result = classifyError(error);
    expect(result.error_code).toBe('PERMISSION_DENIED');
  });

  it('should classify EPERM as PERMISSION_DENIED', () => {
    const error = Object.assign(new Error('operation not permitted'), { code: 'EPERM' });
    const result = classifyError(error);
    expect(result.error_code).toBe('PERMISSION_DENIED');
  });

  it('should classify ENOSPC as DISK_FULL', () => {
    const error = Object.assign(new Error('no space left'), { code: 'ENOSPC' });
    const result = classifyError(error);
    expect(result.error_code).toBe('DISK_FULL');
  });

  it('should classify EROFS as READ_ONLY_FS', () => {
    const error = Object.assign(new Error('read-only file system'), { code: 'EROFS' });
    const result = classifyError(error);
    expect(result.error_code).toBe('READ_ONLY_FS');
  });

  it('should classify ELOOP as SYMLINK_LOOP', () => {
    const error = Object.assign(new Error('too many symbolic links'), { code: 'ELOOP' });
    const result = classifyError(error);
    expect(result.error_code).toBe('SYMLINK_LOOP');
  });

  it('should classify error message containing "utf-8" as INVALID_ENCODING', () => {
    const error = new Error('Invalid UTF-8 byte sequence');
    const result = classifyError(error);
    expect(result.error_code).toBe('INVALID_ENCODING');
  });

  it('should classify error message containing "encoding" as INVALID_ENCODING', () => {
    const error = new Error('Bad encoding detected');
    const result = classifyError(error);
    expect(result.error_code).toBe('INVALID_ENCODING');
  });

  it('should classify error message containing "utf8" as INVALID_ENCODING', () => {
    const error = new Error('Invalid utf8 data');
    const result = classifyError(error);
    expect(result.error_code).toBe('INVALID_ENCODING');
  });

  it('should classify generic Error (no code) as UNKNOWN_ERROR', () => {
    const error = new Error('something went wrong');
    const result = classifyError(error);
    expect(result.error_code).toBe('UNKNOWN_ERROR');
    expect(result.message).toBe('something went wrong');
  });

  it('should classify non-Error value with filePath as UNKNOWN_ERROR with filePath in message', () => {
    const result = classifyError('string error', '/path/to/file.txt');
    expect(result.error_code).toBe('UNKNOWN_ERROR');
    expect(result.message).toContain('/path/to/file.txt');
  });

  it('should classify non-Error value without filePath as UNKNOWN_ERROR with "Unknown error"', () => {
    const result = classifyError('string error');
    expect(result.error_code).toBe('UNKNOWN_ERROR');
    expect(result.message).toBe('Unknown error');
  });
});

describe('getRecoveryHints', () => {
  it('should return 2 hints for MATCH_NOT_FOUND', () => {
    const hints = getRecoveryHints('MATCH_NOT_FOUND');
    expect(hints).toHaveLength(2);
    expect(hints[0]).toContain('whitespace');
    expect(hints[1]).toContain('Re-read');
  });

  it('should return 2 hints for AMBIGUOUS_MATCH', () => {
    const hints = getRecoveryHints('AMBIGUOUS_MATCH');
    expect(hints).toHaveLength(2);
    expect(hints[0]).toContain('replace_all');
    expect(hints[1]).toContain('more specific');
  });

  it('should return hints for FILE_NOT_FOUND', () => {
    const hints = getRecoveryHints('FILE_NOT_FOUND');
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]).toContain('file path');
  });

  it('should return hints for PERMISSION_DENIED', () => {
    const hints = getRecoveryHints('PERMISSION_DENIED');
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]).toContain('permissions');
  });

  it('should return hints for VALIDATION_FAILED', () => {
    const hints = getRecoveryHints('VALIDATION_FAILED');
    expect(hints.length).toBeGreaterThan(0);
  });

  it('should return hints for RELATIVE_PATH', () => {
    const hints = getRecoveryHints('RELATIVE_PATH');
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]).toContain('absolute');
  });

  it('should return hints for PATH_TRAVERSAL', () => {
    const hints = getRecoveryHints('PATH_TRAVERSAL');
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]).toContain('..');
  });

  it('should return hints for EMPTY_EDITS', () => {
    const hints = getRecoveryHints('EMPTY_EDITS');
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]).toContain('at least one');
  });

  it('should return hints for EMPTY_OLD_STRING', () => {
    const hints = getRecoveryHints('EMPTY_OLD_STRING');
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]).toContain('non-empty');
  });

  it('should return hints for DUPLICATE_OLD_STRING', () => {
    const hints = getRecoveryHints('DUPLICATE_OLD_STRING');
    expect(hints).toHaveLength(2);
  });

  it('should return hints for DUPLICATE_FILE_PATH', () => {
    const hints = getRecoveryHints('DUPLICATE_FILE_PATH');
    expect(hints).toHaveLength(2);
  });

  it('should return hints for INVALID_ENCODING', () => {
    const hints = getRecoveryHints('INVALID_ENCODING');
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]).toContain('UTF-8');
  });

  it('should return hints for DISK_FULL', () => {
    const hints = getRecoveryHints('DISK_FULL');
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]).toContain('disk space');
  });

  it('should return hints for READ_ONLY_FS', () => {
    const hints = getRecoveryHints('READ_ONLY_FS');
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]).toContain('writable');
  });

  it('should return hints for SYMLINK_LOOP', () => {
    const hints = getRecoveryHints('SYMLINK_LOOP');
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]).toContain('symlinks');
  });

  it('should return hints for BACKUP_FAILED', () => {
    const hints = getRecoveryHints('BACKUP_FAILED');
    expect(hints).toHaveLength(2);
  });

  it('should return hints for WRITE_FAILED', () => {
    const hints = getRecoveryHints('WRITE_FAILED');
    expect(hints.length).toBeGreaterThan(0);
  });

  it('should return hints for UNKNOWN_TOOL', () => {
    const hints = getRecoveryHints('UNKNOWN_TOOL');
    expect(hints.length).toBeGreaterThan(0);
  });

  it('should return hints for NOT_IMPLEMENTED', () => {
    const hints = getRecoveryHints('NOT_IMPLEMENTED');
    expect(hints.length).toBeGreaterThan(0);
  });

  it('should return default hints for UNKNOWN_ERROR (default case)', () => {
    const hints = getRecoveryHints('UNKNOWN_ERROR');
    expect(hints).toEqual(['Check error details and retry']);
  });
});

describe('extractFileContext', () => {
  it('should return empty object for empty string input', () => {
    const result = extractFileContext('', 'search');
    expect(result).toEqual({});
  });

  it('should return snippet around partial match at 20-char prefix', () => {
    const lines = Array.from({ length: 16 }, (_, i) => `row_${i + 1}_data`);
    // Place a unique string at line 10 (index 9)
    lines[9] = 'UNIQUE_MARKER_ABCDEF_found_here';
    const content = lines.join('\n');
    // searchString whose first 20 chars match line 10's prefix
    const searchString = 'UNIQUE_MARKER_ABCDEF_found_here_plus_extra_stuff';
    const result = extractFileContext(content, searchString);
    expect(result.snippet).toBeDefined();
    expect(result.snippet).toContain('UNIQUE_MARKER_ABCDEF_found_here');
  });

  it('should return snippet around partial match at 10-char prefix', () => {
    // searchString length >= 10 but < 20, so 20 prefix skips, 10 prefix matches
    const content = 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nfindme_abc\nline11';
    const searchString = 'findme_abc_rest';
    const result = extractFileContext(content, searchString);
    expect(result.snippet).toBeDefined();
    expect(result.snippet).toContain('findme_abc');
  });

  it('should return snippet for short search string (< 5 chars)', () => {
    const content = 'aaa\nbbb\nccc\nxyz\neee\nfff\nggg';
    const searchString = 'xyz';
    const result = extractFileContext(content, searchString);
    expect(result.snippet).toBeDefined();
    expect(result.snippet).toContain('xyz');
  });

  it('should return first 15 lines when no match found at all', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`);
    const content = lines.join('\n');
    const searchString = 'ZZZNOTFOUND';
    const result = extractFileContext(content, searchString);
    expect(result.snippet).toBeDefined();
    // First 15 lines
    expect(result.snippet!.split('\n')).toHaveLength(15);
    expect(result.snippet).toContain('line1');
    expect(result.snippet).toContain('line15');
    expect(result.snippet).not.toContain('line16');
  });
});

describe('extractMatchLocations', () => {
  it('should return empty object for empty positions array', () => {
    const result = extractMatchLocations('content', 'search', []);
    expect(result).toEqual({});
  });

  it('should return match_locations with 2 entries for 2 positions', () => {
    const content = 'foo bar\nfoo baz\nfoo qux';
    const positions = [0, 8]; // 'foo' at line 1 and line 2
    const result = extractMatchLocations(content, 'foo', positions);
    expect(result.match_locations).toBeDefined();
    expect(result.match_locations).toHaveLength(2);
    expect(result.match_locations![0].line).toBe(1);
    expect(result.match_locations![1].line).toBe(2);
    expect(result.match_locations![0].snippet).toBeDefined();
    expect(result.match_locations![1].snippet).toBeDefined();
  });

  it('should return only first 5 locations plus snippet note when 6+ positions', () => {
    // Create content with 7 occurrences of 'match' on separate lines
    const lines = Array.from({ length: 7 }, (_, i) => `match at line ${i + 1}`);
    const content = lines.join('\n');
    // Get actual positions of 'match' in the content
    const positions: number[] = [];
    let idx = content.indexOf('match');
    while (idx !== -1) {
      positions.push(idx);
      idx = content.indexOf('match', idx + 1);
    }
    expect(positions.length).toBe(7);

    const result = extractMatchLocations(content, 'match', positions);
    expect(result.match_locations).toHaveLength(5);
    expect(result.snippet).toBe('5 of 7 matches shown');
  });

  it('should return 1-based line numbers', () => {
    const content = 'first\nsecond\nthird';
    const positions = [13]; // 'third' starts at index 13
    const result = extractMatchLocations(content, 'third', positions);
    expect(result.match_locations).toBeDefined();
    expect(result.match_locations![0].line).toBe(3);
  });
});

describe('buildEditStatus', () => {
  it('should mark single edit at index 0 as failed', () => {
    const edits = [{ old_string: 'find me' }];
    const result = buildEditStatus(edits, 0, 'MATCH_NOT_FOUND', 'not found');
    expect(result).toHaveLength(1);
    expect(result[0].edit_index).toBe(0);
    expect(result[0].status).toBe('failed');
    expect(result[0].error_code).toBe('MATCH_NOT_FOUND');
    expect(result[0].message).toBe('not found');
  });

  it('should mark edit at index 1 as failed and index 2 as skipped', () => {
    const edits = [
      { old_string: 'edit0' },
      { old_string: 'edit1' },
      { old_string: 'edit2' },
    ];
    const result = buildEditStatus(edits, 1, 'AMBIGUOUS_MATCH', 'ambiguous');
    expect(result).toHaveLength(2);
    expect(result[0].edit_index).toBe(1);
    expect(result[0].status).toBe('failed');
    expect(result[1].edit_index).toBe(2);
    expect(result[1].status).toBe('skipped');
  });

  it('should truncate old_string_preview to 40 chars', () => {
    const longString = 'a'.repeat(60);
    const edits = [{ old_string: longString }];
    const result = buildEditStatus(edits, 0, 'MATCH_NOT_FOUND', 'err');
    expect(result[0].old_string_preview).toBe('a'.repeat(40));
  });
});

describe('createErrorEnvelope', () => {
  it('should create envelope with minimal args', () => {
    const envelope = createErrorEnvelope({
      error_code: 'MATCH_NOT_FOUND',
      message: 'old_string not found',
    });
    expect(envelope.success).toBe(false);
    expect(envelope.error_code).toBe('MATCH_NOT_FOUND');
    expect(envelope.message).toBe('old_string not found');
    expect(envelope.retryable).toBe(true);
    expect(envelope.recovery_hints.length).toBeGreaterThan(0);
  });

  it('should include all optional fields when provided', () => {
    const envelope = createErrorEnvelope({
      error_code: 'MATCH_NOT_FOUND',
      message: 'not found',
      file_path: '/tmp/test.txt',
      edit_index: 2,
      context: { snippet: 'some context' },
      edit_status: [{ edit_index: 2, status: 'failed' }],
      backup_path: '/tmp/test.txt.bak',
    });
    expect(envelope.file_path).toBe('/tmp/test.txt');
    expect(envelope.edit_index).toBe(2);
    expect(envelope.context).toEqual({ snippet: 'some context' });
    expect(envelope.edit_status).toHaveLength(1);
    expect(envelope.backup_path).toBe('/tmp/test.txt.bak');
  });

  it('should omit optional fields when not provided', () => {
    const envelope = createErrorEnvelope({
      error_code: 'UNKNOWN_ERROR',
      message: 'something broke',
    });
    expect('file_path' in envelope).toBe(false);
    expect('edit_index' in envelope).toBe(false);
    expect('context' in envelope).toBe(false);
    expect('edit_status' in envelope).toBe(false);
    expect('backup_path' in envelope).toBe(false);
  });

  it('should set retryable=true for retryable code and false for non-retryable', () => {
    const retryableEnvelope = createErrorEnvelope({
      error_code: 'MATCH_NOT_FOUND',
      message: 'retryable error',
    });
    expect(retryableEnvelope.retryable).toBe(true);

    const nonRetryableEnvelope = createErrorEnvelope({
      error_code: 'UNKNOWN_ERROR',
      message: 'not retryable',
    });
    expect(nonRetryableEnvelope.retryable).toBe(false);
  });
});

describe('isRetryable and RETRYABLE_CODES', () => {
  it('should return true for MATCH_NOT_FOUND', () => {
    expect(isRetryable('MATCH_NOT_FOUND')).toBe(true);
  });

  it('should return false for UNKNOWN_ERROR', () => {
    expect(isRetryable('UNKNOWN_ERROR')).toBe(false);
  });

  it('should contain all expected retryable codes', () => {
    expect(RETRYABLE_CODES.has('VALIDATION_FAILED')).toBe(true);
    expect(RETRYABLE_CODES.has('RELATIVE_PATH')).toBe(true);
    expect(RETRYABLE_CODES.has('PATH_TRAVERSAL')).toBe(true);
    expect(RETRYABLE_CODES.has('EMPTY_EDITS')).toBe(true);
    expect(RETRYABLE_CODES.has('EMPTY_OLD_STRING')).toBe(true);
    expect(RETRYABLE_CODES.has('DUPLICATE_OLD_STRING')).toBe(true);
    expect(RETRYABLE_CODES.has('DUPLICATE_FILE_PATH')).toBe(true);
    expect(RETRYABLE_CODES.has('MATCH_NOT_FOUND')).toBe(true);
    expect(RETRYABLE_CODES.has('AMBIGUOUS_MATCH')).toBe(true);
  });

  it('should not contain non-retryable codes', () => {
    expect(RETRYABLE_CODES.has('FILE_NOT_FOUND')).toBe(false);
    expect(RETRYABLE_CODES.has('PERMISSION_DENIED')).toBe(false);
    expect(RETRYABLE_CODES.has('UNKNOWN_ERROR')).toBe(false);
  });
});
