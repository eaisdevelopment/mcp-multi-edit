/**
 * Unit tests for validator.ts pure/sync functions
 *
 * Tests pure (non-IO) functions directly with static imports.
 * No filesystem mocking needed.
 */

import { describe, it, expect } from 'vitest';
import {
  validatePath,
  detectDuplicateOldStrings,
  formatZodErrors,
  MultiEditInputSchema,
  MultiEditFilesInputSchema,
} from '../../src/core/validator.js';

describe('validatePath', () => {
  it('should return null for valid absolute path', () => {
    expect(validatePath('/home/user/file.ts')).toBeNull();
  });

  it('should return RELATIVE_PATH error for relative path', () => {
    const result = validatePath('relative/path.ts');
    expect(result).not.toBeNull();
    expect(result!.code).toBe('RELATIVE_PATH');
    expect(result!.recovery_hint).toBeDefined();
  });

  it('should return PATH_TRAVERSAL error for path with ".."', () => {
    const result = validatePath('/home/user/../etc/passwd');
    expect(result).not.toBeNull();
    expect(result!.code).toBe('PATH_TRAVERSAL');
    expect(result!.recovery_hint).toBeDefined();
  });

  it('should return RELATIVE_PATH error for path starting with "./"', () => {
    const result = validatePath('./local/file.ts');
    expect(result).not.toBeNull();
    expect(result!.code).toBe('RELATIVE_PATH');
    expect(result!.recovery_hint).toBeDefined();
  });

  it('should return null for root path "/"', () => {
    expect(validatePath('/')).toBeNull();
  });

  it('should have recovery_hint defined on all returned errors', () => {
    const errors = [
      validatePath('relative.ts'),
      validatePath('/foo/../bar'),
    ].filter((e) => e !== null);

    expect(errors.length).toBe(2);
    for (const error of errors) {
      expect(error!.recovery_hint).toBeDefined();
      expect(typeof error!.recovery_hint).toBe('string');
      expect(error!.recovery_hint.length).toBeGreaterThan(0);
    }
  });
});

describe('detectDuplicateOldStrings', () => {
  it('should return empty array for unique old_strings', () => {
    const edits = [
      { old_string: 'foo', new_string: 'bar' },
      { old_string: 'baz', new_string: 'qux' },
    ];
    expect(detectDuplicateOldStrings(edits)).toEqual([]);
  });

  it('should return 1 error for single duplicate pair with DUPLICATE_OLD_STRING code', () => {
    const edits = [
      { old_string: 'foo', new_string: 'bar' },
      { old_string: 'foo', new_string: 'baz' },
    ];
    const errors = detectDuplicateOldStrings(edits);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('DUPLICATE_OLD_STRING');
  });

  it('should have correct path for duplicate error', () => {
    const edits = [
      { old_string: 'aaa', new_string: '1' },
      { old_string: 'bbb', new_string: '2' },
      { old_string: 'aaa', new_string: '3' },
    ];
    const errors = detectDuplicateOldStrings(edits);
    expect(errors).toHaveLength(1);
    // The duplicate is at index 2
    expect(errors[0].path).toEqual(['edits', '2', 'old_string']);
  });

  it('should return multiple errors for multiple different duplicates', () => {
    const edits = [
      { old_string: 'foo', new_string: '1' },
      { old_string: 'bar', new_string: '2' },
      { old_string: 'foo', new_string: '3' },
      { old_string: 'bar', new_string: '4' },
    ];
    const errors = detectDuplicateOldStrings(edits);
    expect(errors).toHaveLength(2);
    expect(errors.every((e) => e.code === 'DUPLICATE_OLD_STRING')).toBe(true);
  });

  it('should return 2 errors for three identical old_strings', () => {
    const edits = [
      { old_string: 'dup', new_string: '1' },
      { old_string: 'dup', new_string: '2' },
      { old_string: 'dup', new_string: '3' },
    ];
    const errors = detectDuplicateOldStrings(edits);
    expect(errors).toHaveLength(2);
    // Second and third flagged (indices 1 and 2)
    expect(errors[0].path).toEqual(['edits', '1', 'old_string']);
    expect(errors[1].path).toEqual(['edits', '2', 'old_string']);
  });
});

describe('formatZodErrors', () => {
  it('should return error with SCHEMA_ code for empty edits array', () => {
    const result = MultiEditInputSchema.safeParse({
      file_path: '/test.ts',
      edits: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].code).toMatch(/^SCHEMA_/);
      expect(errors[0].code).toBe('SCHEMA_TOO_SMALL');
    }
  });

  it('should return SCHEMA_TOO_SMALL with recovery_hint for empty old_string', () => {
    const result = MultiEditInputSchema.safeParse({
      file_path: '/f.ts',
      edits: [{ old_string: '', new_string: 'x' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].code).toBe('SCHEMA_TOO_SMALL');
      expect(errors[0].recovery_hint).toBeDefined();
      // The Zod path contains both 'edits' and 'old_string'; formatZodErrors
      // matches 'edits' first in the switch, so recovery_hint mentions edit operations
      expect(errors[0].recovery_hint.length).toBeGreaterThan(0);
    }
  });

  it('should return SCHEMA_INVALID_TYPE for missing required field (file_path)', () => {
    const result = MultiEditInputSchema.safeParse({
      edits: [{ old_string: 'a', new_string: 'b' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].code).toBe('SCHEMA_INVALID_TYPE');
    }
  });

  it('should return SCHEMA_INVALID_TYPE with recovery_hint for wrong type (file_path as number)', () => {
    const result = MultiEditInputSchema.safeParse({
      file_path: 123,
      edits: [{ old_string: 'a', new_string: 'b' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].code).toBe('SCHEMA_INVALID_TYPE');
      expect(errors[0].recovery_hint).toBeDefined();
      // recovery_hint should mention expected type
      expect(errors[0].recovery_hint.toLowerCase()).toContain('string');
    }
  });

  it('should always define recovery_hint on all errors', () => {
    const result = MultiEditInputSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      for (const error of errors) {
        expect(error.recovery_hint).toBeDefined();
        expect(typeof error.recovery_hint).toBe('string');
        expect(error.recovery_hint.length).toBeGreaterThan(0);
      }
    }
  });

  it('should return SCHEMA_TOO_SMALL for empty files array in MultiEditFilesInputSchema', () => {
    const result = MultiEditFilesInputSchema.safeParse({
      files: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].code).toBe('SCHEMA_TOO_SMALL');
    }
  });
});

describe('MultiEditInputSchema defaults', () => {
  it('should default include_content to false', () => {
    const result = MultiEditInputSchema.safeParse({
      file_path: '/test.ts',
      edits: [{ old_string: 'a', new_string: 'b' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.include_content).toBe(false);
    }
  });

  it('should default backup to true', () => {
    const result = MultiEditInputSchema.safeParse({
      file_path: '/test.ts',
      edits: [{ old_string: 'a', new_string: 'b' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.backup).toBe(true);
    }
  });

  it('should default dry_run to false', () => {
    const result = MultiEditInputSchema.safeParse({
      file_path: '/test.ts',
      edits: [{ old_string: 'a', new_string: 'b' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dry_run).toBe(false);
    }
  });

  it('should default replace_all per-edit to false', () => {
    const result = MultiEditInputSchema.safeParse({
      file_path: '/test.ts',
      edits: [{ old_string: 'a', new_string: 'b' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.edits[0].replace_all).toBe(false);
    }
  });
});
