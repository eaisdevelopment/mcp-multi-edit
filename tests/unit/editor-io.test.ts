/**
 * Filesystem-mocked unit tests for editor.ts IO functions
 * Uses memfs to test readFileValidated, atomicWrite, createBackup, applyEdits
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fs, vol } from 'memfs';

// editor.ts imports 'fs/promises' (no node: prefix)
vi.mock('fs/promises', () => ({ default: fs.promises, ...fs.promises }));

// editor.ts also imports 'path' and 'crypto' which should NOT be mocked
// editor.ts imports 'buffer' for isUtf8 - we leave it real unless specific test needs

beforeEach(() => {
  vol.reset();
  vi.restoreAllMocks();
});

describe('readFileValidated (memfs)', () => {
  it('should read valid UTF-8 file content', async () => {
    vol.fromJSON({ '/test/file.txt': 'hello world' });
    const { readFileValidated } = await import('../../src/core/editor.js');
    const content = await readFileValidated('/test/file.txt');
    expect(content).toBe('hello world');
  });

  it('should read multiline content correctly', async () => {
    vol.fromJSON({ '/test/multi.txt': 'line one\nline two\nline three' });
    const { readFileValidated } = await import('../../src/core/editor.js');
    const content = await readFileValidated('/test/multi.txt');
    expect(content).toBe('line one\nline two\nline three');
  });

  it('should reject non-existent file with ENOENT', async () => {
    const { readFileValidated } = await import('../../src/core/editor.js');
    await expect(readFileValidated('/nonexistent/file.txt')).rejects.toThrow();
  });

  it('should read empty file content', async () => {
    vol.fromJSON({ '/test/empty.txt': '' });
    const { readFileValidated } = await import('../../src/core/editor.js');
    const content = await readFileValidated('/test/empty.txt');
    expect(content).toBe('');
  });
});

describe('atomicWrite (memfs)', () => {
  it('should write file with correct content', async () => {
    vol.mkdirSync('/test', { recursive: true });
    const { atomicWrite } = await import('../../src/core/editor.js');
    await atomicWrite('/test/file.txt', 'new content');
    const written = vol.readFileSync('/test/file.txt', 'utf8');
    expect(written).toBe('new content');
  });

  it('should overwrite existing file content', async () => {
    vol.fromJSON({ '/test/file.txt': 'old content' });
    const { atomicWrite } = await import('../../src/core/editor.js');
    await atomicWrite('/test/file.txt', 'updated content');
    const content = vol.readFileSync('/test/file.txt', 'utf8');
    expect(content).toBe('updated content');
  });

  it('should write complete content atomically (not partial)', async () => {
    vol.mkdirSync('/test', { recursive: true });
    const { atomicWrite } = await import('../../src/core/editor.js');
    const largeContent = 'x'.repeat(10000) + '\nend marker';
    await atomicWrite('/test/large.txt', largeContent);
    const written = vol.readFileSync('/test/large.txt', 'utf8');
    expect(written).toBe(largeContent);
    expect(written).toContain('end marker');
  });

  it('should handle multiline content correctly', async () => {
    vol.mkdirSync('/test', { recursive: true });
    const { atomicWrite } = await import('../../src/core/editor.js');
    const content = 'line1\nline2\nline3\n';
    await atomicWrite('/test/multi.txt', content);
    const written = vol.readFileSync('/test/multi.txt', 'utf8');
    expect(written).toBe(content);
  });
});

describe('createBackup (memfs)', () => {
  it('should create backup file with .bak extension', async () => {
    vol.fromJSON({ '/test/file.txt': 'original content' });
    const { createBackup } = await import('../../src/core/editor.js');
    const backupPath = await createBackup('/test/file.txt', 'original content');
    expect(backupPath).toBe('/test/file.txt.bak');
  });

  it('should preserve original content in backup', async () => {
    vol.fromJSON({ '/test/file.txt': 'precious data' });
    const { createBackup } = await import('../../src/core/editor.js');
    await createBackup('/test/file.txt', 'precious data');
    const backupContent = vol.readFileSync('/test/file.txt.bak', 'utf8');
    expect(backupContent).toBe('precious data');
  });

  it('should return correct backup path format', async () => {
    vol.fromJSON({ '/test/deep/path/file.ts': 'code' });
    const { createBackup } = await import('../../src/core/editor.js');
    const backupPath = await createBackup('/test/deep/path/file.ts', 'code');
    expect(backupPath).toBe('/test/deep/path/file.ts.bak');
  });

  it('should handle backup of file with special characters in content', async () => {
    const specialContent = 'line1\n\ttabbed\n  spaced\nunicode: \u00e9\u00e8\u00ea';
    vol.fromJSON({ '/test/special.txt': specialContent });
    const { createBackup } = await import('../../src/core/editor.js');
    await createBackup('/test/special.txt', specialContent);
    const backupContent = vol.readFileSync('/test/special.txt.bak', 'utf8');
    expect(backupContent).toBe(specialContent);
  });
});

describe('applyEdits with IO (memfs)', () => {
  it('should read file, apply edits, and write result', async () => {
    vol.fromJSON({ '/test/file.txt': 'hello world' });
    const { applyEdits } = await import('../../src/core/editor.js');
    const result = await applyEdits('/test/file.txt', [
      { old_string: 'world', new_string: 'there' }
    ], false, false);

    expect(result.success).toBe(true);
    expect(result.edits_applied).toBe(1);
    const content = vol.readFileSync('/test/file.txt', 'utf8');
    expect(content).toBe('hello there');
  });

  it('should create .bak file when backup=true', async () => {
    vol.fromJSON({ '/test/file.txt': 'original' });
    const { applyEdits } = await import('../../src/core/editor.js');
    const result = await applyEdits('/test/file.txt', [
      { old_string: 'original', new_string: 'modified' }
    ], false, true);

    expect(result.success).toBe(true);
    expect(result.backup_path).toBe('/test/file.txt.bak');
    const backupContent = vol.readFileSync('/test/file.txt.bak', 'utf8');
    expect(backupContent).toBe('original');
  });

  it('should NOT create .bak file when backup=false', async () => {
    vol.fromJSON({ '/test/file.txt': 'content' });
    const { applyEdits } = await import('../../src/core/editor.js');
    const result = await applyEdits('/test/file.txt', [
      { old_string: 'content', new_string: 'updated' }
    ], false, false);

    expect(result.success).toBe(true);
    expect(result.backup_path).toBeUndefined();
    expect(vol.existsSync('/test/file.txt.bak')).toBe(false);
  });

  it('should not modify file in dry-run mode', async () => {
    vol.fromJSON({ '/test/file.txt': 'original content' });
    const { applyEdits } = await import('../../src/core/editor.js');
    const result = await applyEdits('/test/file.txt', [
      { old_string: 'original', new_string: 'changed' }
    ], true, false);

    expect(result.success).toBe(true);
    expect(result.dry_run).toBe(true);
    expect(result.final_content).toBe('changed content');
    // Verify file was NOT modified
    const content = vol.readFileSync('/test/file.txt', 'utf8');
    expect(content).toBe('original content');
  });
});
