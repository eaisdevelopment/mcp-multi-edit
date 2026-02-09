/**
 * Filesystem-mocked unit tests for validator.ts async functions
 * Uses memfs to test validateFileExists, detectDuplicateFilePaths,
 * validateMultiEditInputFull, validateMultiEditFilesInputFull
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fs, vol } from 'memfs';

// validator.ts imports 'node:fs/promises' (WITH node: prefix)
vi.mock('node:fs/promises', () => ({ default: fs.promises, ...fs.promises }));

beforeEach(() => {
  vol.reset();
  vi.restoreAllMocks();
});

describe('validateFileExists (memfs)', () => {
  it('should return resolvedPath for existing file', async () => {
    vol.fromJSON({ '/test/file.txt': 'content' });
    const { validateFileExists } = await import('../../src/core/validator.js');
    const result = await validateFileExists('/test/file.txt');
    expect(result).toHaveProperty('resolvedPath');
    expect((result as { resolvedPath: string }).resolvedPath).toBe('/test/file.txt');
  });

  it('should return FILE_NOT_FOUND for non-existent file', async () => {
    const { validateFileExists } = await import('../../src/core/validator.js');
    const result = await validateFileExists('/nonexistent/file.txt');
    expect(result).toHaveProperty('code', 'FILE_NOT_FOUND');
  });

  it('should include recovery_hint on error responses', async () => {
    const { validateFileExists } = await import('../../src/core/validator.js');
    const result = await validateFileExists('/does/not/exist.txt');
    expect(result).toHaveProperty('code');
    expect(result).toHaveProperty('recovery_hint');
    expect((result as { recovery_hint: string }).recovery_hint).toBeTruthy();
  });

  it('should include path in error responses', async () => {
    const { validateFileExists } = await import('../../src/core/validator.js');
    const result = await validateFileExists('/missing.txt');
    expect(result).toHaveProperty('path');
    expect((result as { path: string[] }).path).toEqual(['file_path']);
  });

  it('should return PERMISSION_DENIED for EACCES', async () => {
    // Need fresh modules so the validator picks up our spy
    vi.resetModules();
    vi.mock('node:fs/promises', () => {
      const { fs: memfs } = require('memfs');
      return { default: memfs.promises, ...memfs.promises };
    });
    const fsModule = await import('node:fs/promises');
    // Spy on the default export's realpath (validator uses: fs.realpath)
    vi.spyOn(fsModule.default, 'realpath').mockRejectedValueOnce(
      Object.assign(new Error('EACCES'), { code: 'EACCES' })
    );
    const { validateFileExists } = await import('../../src/core/validator.js');
    const result = await validateFileExists('/test/no-access.txt');
    expect(result).toHaveProperty('code', 'PERMISSION_DENIED');
  });
});

describe('detectDuplicateFilePaths (memfs)', () => {
  it('should return empty array for unique file paths', async () => {
    vol.fromJSON({ '/test/a.txt': 'a', '/test/b.txt': 'b' });
    const { detectDuplicateFilePaths } = await import('../../src/core/validator.js');
    const errors = await detectDuplicateFilePaths([
      { file_path: '/test/a.txt' },
      { file_path: '/test/b.txt' },
    ]);
    expect(errors).toEqual([]);
  });

  it('should detect duplicate paths', async () => {
    vol.fromJSON({ '/test/file.txt': 'content' });
    const { detectDuplicateFilePaths } = await import('../../src/core/validator.js');
    const errors = await detectDuplicateFilePaths([
      { file_path: '/test/file.txt' },
      { file_path: '/test/file.txt' },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('DUPLICATE_FILE_PATH');
  });

  it('should skip non-existent files in duplicate detection', async () => {
    vol.fromJSON({ '/test/exists.txt': 'yes' });
    const { detectDuplicateFilePaths } = await import('../../src/core/validator.js');
    const errors = await detectDuplicateFilePaths([
      { file_path: '/test/exists.txt' },
      { file_path: '/test/missing.txt' },
    ]);
    // Missing files are skipped, so no duplicate errors
    expect(errors).toEqual([]);
  });

  it('should include file index in error path', async () => {
    vol.fromJSON({ '/test/file.txt': 'content' });
    const { detectDuplicateFilePaths } = await import('../../src/core/validator.js');
    const errors = await detectDuplicateFilePaths([
      { file_path: '/test/file.txt' },
      { file_path: '/test/file.txt' },
    ]);
    expect(errors[0].path).toEqual(['files', '1', 'file_path']);
  });
});

describe('validateMultiEditInputFull (memfs)', () => {
  it('should return schema errors for invalid input (Layer 1)', async () => {
    const { validateMultiEditInputFull } = await import('../../src/core/validator.js');
    // Missing file_path
    const result = await validateMultiEditInputFull({
      edits: [{ old_string: 'a', new_string: 'b' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].code).toMatch(/^SCHEMA_/);
    }
  });

  it('should return RELATIVE_PATH error for relative path (Layer 2)', async () => {
    const { validateMultiEditInputFull } = await import('../../src/core/validator.js');
    const result = await validateMultiEditInputFull({
      file_path: 'relative/path.ts',
      edits: [{ old_string: 'a', new_string: 'b' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0].code).toBe('RELATIVE_PATH');
    }
  });

  it('should return DUPLICATE_OLD_STRING error for duplicate edits (Layer 3)', async () => {
    const { validateMultiEditInputFull } = await import('../../src/core/validator.js');
    const result = await validateMultiEditInputFull({
      file_path: '/test/file.ts',
      edits: [
        { old_string: 'foo', new_string: 'bar' },
        { old_string: 'foo', new_string: 'baz' },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0].code).toBe('DUPLICATE_OLD_STRING');
    }
  });

  it('should return FILE_NOT_FOUND for non-existent file (Layer 4)', async () => {
    const { validateMultiEditInputFull } = await import('../../src/core/validator.js');
    const result = await validateMultiEditInputFull({
      file_path: '/test/missing.ts',
      edits: [{ old_string: 'a', new_string: 'b' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0].code).toBe('FILE_NOT_FOUND');
    }
  });

  it('should return success with resolvedPath for valid input', async () => {
    vol.fromJSON({ '/test/file.ts': 'const x = 1;' });
    const { validateMultiEditInputFull } = await import('../../src/core/validator.js');
    const result = await validateMultiEditInputFull({
      file_path: '/test/file.ts',
      edits: [{ old_string: 'const x = 1;', new_string: 'const x = 2;' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.file_path).toBe('/test/file.ts');
    }
  });

  it('should set default values in successful validation', async () => {
    vol.fromJSON({ '/test/file.ts': 'content' });
    const { validateMultiEditInputFull } = await import('../../src/core/validator.js');
    const result = await validateMultiEditInputFull({
      file_path: '/test/file.ts',
      edits: [{ old_string: 'content', new_string: 'new' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dry_run).toBe(false);
      expect(result.data.backup).toBe(true);
      expect(result.data.include_content).toBe(false);
    }
  });
});

describe('validateMultiEditFilesInputFull (memfs)', () => {
  it('should return schema error for empty files array (Layer 1 hard stop)', async () => {
    const { validateMultiEditFilesInputFull } = await import('../../src/core/validator.js');
    const result = await validateMultiEditFilesInputFull({
      files: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0].code).toMatch(/SCHEMA_TOO_SMALL/);
    }
  });

  it('should return error for relative path in file entry (Layer 2)', async () => {
    const { validateMultiEditFilesInputFull } = await import('../../src/core/validator.js');
    const result = await validateMultiEditFilesInputFull({
      files: [
        {
          file_path: 'relative/file.ts',
          edits: [{ old_string: 'a', new_string: 'b' }],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const relativeError = result.errors.find(e => e.code === 'RELATIVE_PATH');
      expect(relativeError).toBeDefined();
      expect(relativeError!.path).toEqual(['files', '0', 'file_path']);
    }
  });

  it('should return FILE_NOT_FOUND for non-existent files (Layer 4)', async () => {
    const { validateMultiEditFilesInputFull } = await import('../../src/core/validator.js');
    const result = await validateMultiEditFilesInputFull({
      files: [
        {
          file_path: '/test/missing.ts',
          edits: [{ old_string: 'a', new_string: 'b' }],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const notFoundError = result.errors.find(e => e.code === 'FILE_NOT_FOUND');
      expect(notFoundError).toBeDefined();
    }
  });

  it('should return DUPLICATE_OLD_STRING for duplicate edits per file (Layer 5)', async () => {
    vol.fromJSON({ '/test/file.ts': 'code here' });
    const { validateMultiEditFilesInputFull } = await import('../../src/core/validator.js');
    const result = await validateMultiEditFilesInputFull({
      files: [
        {
          file_path: '/test/file.ts',
          edits: [
            { old_string: 'code', new_string: 'data' },
            { old_string: 'code', new_string: 'info' },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const dupError = result.errors.find(e => e.code === 'DUPLICATE_OLD_STRING');
      expect(dupError).toBeDefined();
      // Path should be prefixed with files index
      expect(dupError!.path![0]).toBe('files');
      expect(dupError!.path![1]).toBe('0');
    }
  });

  it('should return success with resolved paths for valid multi-file input', async () => {
    vol.fromJSON({
      '/test/file1.ts': 'const a = 1;',
      '/test/file2.ts': 'const b = 2;',
    });
    const { validateMultiEditFilesInputFull } = await import('../../src/core/validator.js');
    const result = await validateMultiEditFilesInputFull({
      files: [
        {
          file_path: '/test/file1.ts',
          edits: [{ old_string: 'const a = 1;', new_string: 'const a = 10;' }],
        },
        {
          file_path: '/test/file2.ts',
          edits: [{ old_string: 'const b = 2;', new_string: 'const b = 20;' }],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.files).toHaveLength(2);
      expect(result.data.files[0].file_path).toBe('/test/file1.ts');
      expect(result.data.files[1].file_path).toBe('/test/file2.ts');
    }
  });

  it('should collect errors from BOTH relative path and non-existent file', async () => {
    const { validateMultiEditFilesInputFull } = await import('../../src/core/validator.js');
    const result = await validateMultiEditFilesInputFull({
      files: [
        {
          file_path: 'relative/path.ts',
          edits: [{ old_string: 'a', new_string: 'b' }],
        },
        {
          file_path: '/test/nonexistent.ts',
          edits: [{ old_string: 'c', new_string: 'd' }],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      // Should have at least 2 errors: RELATIVE_PATH for file 0, FILE_NOT_FOUND for file 1
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      const codes = result.errors.map(e => e.code);
      expect(codes).toContain('RELATIVE_PATH');
      expect(codes).toContain('FILE_NOT_FOUND');
    }
  });
});
