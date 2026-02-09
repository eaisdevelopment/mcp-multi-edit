/**
 * Unit tests for editor.ts pure functions
 *
 * Tests pure (non-IO) functions directly with static imports.
 * No filesystem mocking needed.
 */

import { describe, it, expect } from 'vitest';
import {
  getLineNumber,
  findAllMatchPositions,
  getMatchLineNumbers,
  replaceStringCaseAware,
  formatFileError,
  formatBackupError,
} from '../../src/core/editor.js';

describe('getLineNumber', () => {
  it('should return line 1 for charIndex 0 in single-line content', () => {
    expect(getLineNumber('hello world', 0)).toBe(1);
  });

  it('should return line 2 for charIndex after first newline', () => {
    const content = 'line1\nline2';
    // charIndex 6 is the 'l' at the start of 'line2'
    expect(getLineNumber(content, 6)).toBe(2);
  });

  it('should return correct line for charIndex at exact newline position', () => {
    const content = 'line1\nline2';
    // charIndex 5 is the '\n' itself -- substring(0,5) = 'line1' which has 1 line
    expect(getLineNumber(content, 5)).toBe(1);
  });

  it('should return correct line for charIndex at end of multi-line content', () => {
    const content = 'a\nb\nc\nd';
    // charIndex 6 is 'd' -- substring(0,6) = 'a\nb\nc\n' which splits into 4 parts
    expect(getLineNumber(content, 6)).toBe(4);
  });

  it('should return line 1 for empty content with charIndex 0', () => {
    expect(getLineNumber('', 0)).toBe(1);
  });
});

describe('findAllMatchPositions', () => {
  it('should return empty array for empty searchString', () => {
    expect(findAllMatchPositions('hello world', '')).toEqual([]);
  });

  it('should return single position for single match', () => {
    expect(findAllMatchPositions('hello world', 'world')).toEqual([6]);
  });

  it('should return all positions for multiple matches', () => {
    expect(findAllMatchPositions('foo bar foo baz foo', 'foo')).toEqual([0, 8, 16]);
  });

  it('should return empty array when no match found', () => {
    expect(findAllMatchPositions('hello world', 'xyz')).toEqual([]);
  });

  it('should find case-insensitive match when caseInsensitive=true', () => {
    const positions = findAllMatchPositions('Hello World', 'hello', true);
    expect(positions).toEqual([0]);
  });

  it('should find multiple case-variant matches with caseInsensitive=true', () => {
    const content = 'Hello HELLO hello';
    const positions = findAllMatchPositions(content, 'hello', true);
    expect(positions).toEqual([0, 6, 12]);
  });
});

describe('getMatchLineNumbers', () => {
  it('should return line number for single match', () => {
    expect(getMatchLineNumbers('hello world', 'world')).toEqual([1]);
  });

  it('should return correct line numbers for matches on different lines', () => {
    const content = 'foo\nbar\nfoo';
    expect(getMatchLineNumbers(content, 'foo')).toEqual([1, 3]);
  });

  it('should return empty array for no matches', () => {
    expect(getMatchLineNumbers('hello world', 'xyz')).toEqual([]);
  });

  it('should return correct line numbers for case-insensitive match', () => {
    const content = 'Hello\nworld\nhello';
    expect(getMatchLineNumbers(content, 'hello', true)).toEqual([1, 3]);
  });
});

describe('replaceStringCaseAware', () => {
  it('should return content unchanged with replacedCount=0 for empty oldString', () => {
    const result = replaceStringCaseAware('hello world', '', 'x');
    expect(result.content).toBe('hello world');
    expect(result.replacedCount).toBe(0);
  });

  it('should return content unchanged with replacedCount=0 when no match', () => {
    const result = replaceStringCaseAware('hello world', 'xyz', 'abc');
    expect(result.content).toBe('hello world');
    expect(result.replacedCount).toBe(0);
  });

  it('should replace first occurrence only when replaceAll=false', () => {
    const result = replaceStringCaseAware('foo bar foo', 'foo', 'baz', false);
    expect(result.content).toBe('baz bar foo');
    expect(result.replacedCount).toBe(1);
  });

  it('should replace all occurrences when replaceAll=true', () => {
    const result = replaceStringCaseAware('foo bar foo', 'foo', 'baz', true);
    expect(result.content).toBe('baz bar baz');
    expect(result.replacedCount).toBe(2);
  });

  it('should replace case-insensitively with single replacement', () => {
    const result = replaceStringCaseAware('Hello World', 'hello', 'hi', false, true);
    expect(result.content).toBe('hi World');
    expect(result.replacedCount).toBe(1);
  });

  it('should replace all occurrences case-insensitively', () => {
    const result = replaceStringCaseAware('Hello HELLO', 'hello', 'hi', true, true);
    expect(result.content).toBe('hi hi');
    expect(result.replacedCount).toBe(2);
  });

  it('should handle replaceAll + caseInsensitive combo with mixed-case matches', () => {
    const content = 'Foo FOO foo fOo';
    const result = replaceStringCaseAware(content, 'foo', 'bar', true, true);
    expect(result.content).toBe('bar bar bar bar');
    expect(result.replacedCount).toBe(4);
  });
});

describe('formatFileError', () => {
  it('should return "File not found" message for ENOENT error', () => {
    const error = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
    const result = formatFileError(error, '/path/to/missing.txt');
    expect(result).toContain('File not found');
    expect(result).toContain('/path/to/missing.txt');
  });

  it('should return "Permission denied" message for EACCES error', () => {
    const error = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    const result = formatFileError(error, '/path/to/protected.txt');
    expect(result).toContain('Permission denied');
    expect(result).toContain('/path/to/protected.txt');
  });

  it('should return "Permission denied" message for EPERM error', () => {
    const error = Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
    const result = formatFileError(error, '/path/to/restricted.txt');
    expect(result).toContain('Permission denied');
    expect(result).toContain('/path/to/restricted.txt');
  });

  it('should pass through UTF-8 error message unchanged', () => {
    const error = new Error('File contains invalid UTF-8 encoding: /test.txt');
    const result = formatFileError(error, '/test.txt');
    expect(result).toBe('File contains invalid UTF-8 encoding: /test.txt');
  });

  it('should return "Unknown file error" for non-Error value', () => {
    const result = formatFileError('some string error', '/path/to/file.txt');
    expect(result).toContain('Unknown file error');
    expect(result).toContain('/path/to/file.txt');
  });
});

describe('formatBackupError', () => {
  it('should return "Permission denied" message for EACCES error', () => {
    const error = Object.assign(new Error('EACCES'), { code: 'EACCES' });
    const result = formatBackupError(error, '/path/to/file.txt.bak');
    expect(result).toContain('Permission denied');
    expect(result).toContain('/path/to/file.txt.bak');
  });

  it('should return "Permission denied" message for EPERM error', () => {
    const error = Object.assign(new Error('EPERM'), { code: 'EPERM' });
    const result = formatBackupError(error, '/path/to/file.txt.bak');
    expect(result).toContain('Permission denied');
    expect(result).toContain('/path/to/file.txt.bak');
  });

  it('should return "No space left" message for ENOSPC error', () => {
    const error = Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' });
    const result = formatBackupError(error, '/path/to/file.txt.bak');
    expect(result).toContain('No space left');
    expect(result).toContain('/path/to/file.txt.bak');
  });

  it('should return "Read-only file system" message for EROFS error', () => {
    const error = Object.assign(new Error('EROFS'), { code: 'EROFS' });
    const result = formatBackupError(error, '/path/to/file.txt.bak');
    expect(result).toContain('Read-only file system');
    expect(result).toContain('/path/to/file.txt.bak');
  });

  it('should return "Unknown error" message for non-Error value', () => {
    const result = formatBackupError('not an error', '/path/to/file.txt.bak');
    expect(result).toContain('Unknown error');
    expect(result).toContain('/path/to/file.txt.bak');
  });
});
