/**
 * Unit tests for validator.ts
 */

import { describe, it, expect } from 'vitest';
import {
  validateMultiEditInput,
  validateMultiEditFilesInput,
  isAbsolutePath,
  detectOverlappingEdits,
} from '../../src/core/validator.js';

describe('validateMultiEditInput', () => {
  it('should validate correct input', () => {
    const input = {
      file_path: '/path/to/file.ts',
      edits: [
        { old_string: 'foo', new_string: 'bar' },
      ],
    };
    const result = validateMultiEditInput(input);
    expect(result.success).toBe(true);
  });

  it('should reject empty file_path', () => {
    const input = {
      file_path: '',
      edits: [{ old_string: 'foo', new_string: 'bar' }],
    };
    const result = validateMultiEditInput(input);
    expect(result.success).toBe(false);
  });

  it('should reject empty edits array', () => {
    const input = {
      file_path: '/path/to/file.ts',
      edits: [],
    };
    const result = validateMultiEditInput(input);
    expect(result.success).toBe(false);
  });

  it('should reject empty old_string', () => {
    const input = {
      file_path: '/path/to/file.ts',
      edits: [{ old_string: '', new_string: 'bar' }],
    };
    const result = validateMultiEditInput(input);
    expect(result.success).toBe(false);
  });

  it('should allow empty new_string', () => {
    const input = {
      file_path: '/path/to/file.ts',
      edits: [{ old_string: 'foo', new_string: '' }],
    };
    const result = validateMultiEditInput(input);
    expect(result.success).toBe(true);
  });

  it('should set default values', () => {
    const input = {
      file_path: '/path/to/file.ts',
      edits: [{ old_string: 'foo', new_string: 'bar' }],
    };
    const result = validateMultiEditInput(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dry_run).toBe(false);
      expect(result.data.create_backup).toBe(false);
      expect(result.data.edits[0].replace_all).toBe(false);
    }
  });
});

describe('validateMultiEditFilesInput', () => {
  it('should validate correct input', () => {
    const input = {
      files: [
        {
          file_path: '/path/to/file1.ts',
          edits: [{ old_string: 'foo', new_string: 'bar' }],
        },
        {
          file_path: '/path/to/file2.ts',
          edits: [{ old_string: 'baz', new_string: 'qux' }],
        },
      ],
    };
    const result = validateMultiEditFilesInput(input);
    expect(result.success).toBe(true);
  });

  it('should reject empty files array', () => {
    const input = { files: [] };
    const result = validateMultiEditFilesInput(input);
    expect(result.success).toBe(false);
  });
});

describe('isAbsolutePath', () => {
  it('should return true for absolute paths', () => {
    expect(isAbsolutePath('/home/user/file.ts')).toBe(true);
    expect(isAbsolutePath('/file.ts')).toBe(true);
  });

  it('should return false for relative paths', () => {
    expect(isAbsolutePath('file.ts')).toBe(false);
    expect(isAbsolutePath('./file.ts')).toBe(false);
    expect(isAbsolutePath('../file.ts')).toBe(false);
  });
});

describe('detectOverlappingEdits', () => {
  it('should detect when new_string contains another old_string', () => {
    const edits = [
      { old_string: 'foo', new_string: 'foobar' },
      { old_string: 'bar', new_string: 'baz' },
    ];
    const conflicts = detectOverlappingEdits('', edits);
    expect(conflicts).toContain(1);
  });

  it('should detect when old_strings overlap', () => {
    const edits = [
      { old_string: 'foo', new_string: 'x' },
      { old_string: 'foobar', new_string: 'y' },
    ];
    const conflicts = detectOverlappingEdits('', edits);
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it('should return empty array for non-overlapping edits', () => {
    const edits = [
      { old_string: 'foo', new_string: 'xxx' },
      { old_string: 'bar', new_string: 'yyy' },
    ];
    const conflicts = detectOverlappingEdits('', edits);
    expect(conflicts).toEqual([]);
  });
});
