/**
 * Edge case integration tests
 *
 * Tests handler-level behavior with direct calls to handleMultiEdit/handleMultiEditFiles
 * on real temp directory files. Covers unicode content, large files, empty edits,
 * line ending preservation, replace_all, ambiguous matches, and no-op edits.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { handleMultiEdit } from '../../src/tools/multi-edit.js';
import { handleMultiEditFiles } from '../../src/tools/multi-edit-files.js';
import {
  createTempDir,
  createTestFile,
  cleanupTempDir,
} from './helpers/setup.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await createTempDir();
});

afterEach(async () => {
  await cleanupTempDir(tempDir);
});

// ============================================================
// Unicode content
// ============================================================

describe('unicode content', () => {
  it('should handle CJK characters', async () => {
    const filePath = await createTestFile(
      tempDir,
      'cjk.txt',
      'const greeting = "Hello, 世界!";'
    );

    const result = await handleMultiEdit({
      file_path: filePath,
      edits: [{ old_string: 'Hello, 世界!', new_string: 'こんにちは世界!' }],
      backup: false,
    });

    expect(result.isError).toBeFalsy();

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('const greeting = "こんにちは世界!";');
  });

  it('should handle emoji content', async () => {
    const filePath = await createTestFile(
      tempDir,
      'emoji.txt',
      'const rocket = "🚀 launch";'
    );

    const result = await handleMultiEdit({
      file_path: filePath,
      edits: [{ old_string: '🚀 launch', new_string: '🌟 star' }],
      backup: false,
    });

    expect(result.isError).toBeFalsy();

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('🌟 star');
  });

  it('should handle accented characters', async () => {
    const filePath = await createTestFile(
      tempDir,
      'accented.txt',
      'café naïve résumé'
    );

    const result = await handleMultiEdit({
      file_path: filePath,
      edits: [{ old_string: 'café', new_string: 'coffee' }],
      backup: false,
    });

    expect(result.isError).toBeFalsy();

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('coffee naïve résumé');
  });

  it('should handle mixed unicode in multi-file edit', async () => {
    const file1 = await createTestFile(tempDir, 'cjk-multi.txt', '你好世界');
    const file2 = await createTestFile(tempDir, 'emoji-multi.txt', '🚀 launch');

    const result = await handleMultiEditFiles({
      files: [
        {
          file_path: file1,
          edits: [{ old_string: '你好', new_string: 'こんにちは' }],
        },
        {
          file_path: file2,
          edits: [{ old_string: '🚀', new_string: '🌟' }],
        },
      ],
    });

    expect(result.isError).toBeFalsy();

    const content1 = await readFile(file1, 'utf-8');
    expect(content1).toBe('こんにちは世界');

    const content2 = await readFile(file2, 'utf-8');
    expect(content2).toBe('🌟 launch');
  });
});

// ============================================================
// Large files
// ============================================================

describe('large files', () => {
  it('should handle 1MB+ file correctly', async () => {
    // Generate ~1MB file: 20000 lines
    const lines: string[] = [];
    for (let i = 0; i < 20000; i++) {
      lines.push(`line ${i}: ${'x'.repeat(50)}`);
    }
    const largeContent = lines.join('\n');

    const filePath = await createTestFile(tempDir, 'large.txt', largeContent);

    const result = await handleMultiEdit({
      file_path: filePath,
      edits: [{ old_string: 'line 10000:', new_string: 'REPLACED LINE 10000:' }],
      backup: false,
    });

    expect(result.isError).toBeFalsy();

    const content = await readFile(filePath, 'utf-8');
    expect(content.length).toBeGreaterThan(1_000_000);
    expect(content).toContain('REPLACED LINE 10000:');
  }, { timeout: 15000 });

  it('should handle file with very long single line', async () => {
    // 100,000 character single line
    const longLine = 'A'.repeat(49000) + 'MARKER' + 'B'.repeat(51000 - 6);

    const filePath = await createTestFile(tempDir, 'longline.txt', longLine);

    const result = await handleMultiEdit({
      file_path: filePath,
      edits: [{ old_string: 'MARKER', new_string: 'REPLACED' }],
      backup: false,
    });

    expect(result.isError).toBeFalsy();

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('REPLACED');
    expect(content).not.toContain('MARKER');
    expect(content.length).toBe(100000 - 6 + 8); // MARKER(6) -> REPLACED(8)
  });
});

// ============================================================
// Empty and minimal edits
// ============================================================

describe('empty and minimal edits', () => {
  it('should reject empty edits array with VALIDATION_FAILED', async () => {
    const filePath = await createTestFile(tempDir, 'empty-edits.txt', 'content');

    const result = await handleMultiEdit({
      file_path: filePath,
      edits: [],
      backup: false,
    });

    expect(result.isError).toBe(true);

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error_code).toBe('VALIDATION_FAILED');

    // File must remain unchanged
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('content');
  });

  it('should handle no-op edit (old_string === new_string)', async () => {
    const filePath = await createTestFile(tempDir, 'noop.txt', 'hello world');

    const result = await handleMultiEdit({
      file_path: filePath,
      edits: [{ old_string: 'hello', new_string: 'hello' }],
      backup: false,
    });

    expect(result.isError).toBeFalsy();

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('hello world');
  });

  it('should handle edit that produces empty file', async () => {
    const filePath = await createTestFile(tempDir, 'delete-all.txt', 'delete me');

    const result = await handleMultiEdit({
      file_path: filePath,
      edits: [{ old_string: 'delete me', new_string: '' }],
      backup: false,
    });

    expect(result.isError).toBeFalsy();

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('');
  });
});

// ============================================================
// Line endings
// ============================================================

describe('line endings', () => {
  it('should preserve Windows CRLF line endings', async () => {
    const filePath = await createTestFile(
      tempDir,
      'crlf.txt',
      'line1\r\nline2\r\nline3'
    );

    const result = await handleMultiEdit({
      file_path: filePath,
      edits: [{ old_string: 'line2', new_string: 'replaced' }],
      backup: false,
    });

    expect(result.isError).toBeFalsy();

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('line1\r\nreplaced\r\nline3');
  });

  it('should handle mixed line endings', async () => {
    const filePath = await createTestFile(
      tempDir,
      'mixed.txt',
      'unix\nmixed\r\nfile'
    );

    const result = await handleMultiEdit({
      file_path: filePath,
      edits: [{ old_string: 'mixed', new_string: 'changed' }],
      backup: false,
    });

    expect(result.isError).toBeFalsy();

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('unix\nchanged\r\nfile');
  });
});

// ============================================================
// Match behavior
// ============================================================

describe('match behavior', () => {
  it('should replace all occurrences with replace_all flag', async () => {
    const filePath = await createTestFile(
      tempDir,
      'replace-all.txt',
      'aaa bbb aaa ccc aaa'
    );

    const result = await handleMultiEdit({
      file_path: filePath,
      edits: [{ old_string: 'aaa', new_string: 'xxx', replace_all: true }],
      backup: false,
    });

    expect(result.isError).toBeFalsy();

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('xxx bbb xxx ccc xxx');
  });

  it('should error on ambiguous match without replace_all', async () => {
    const filePath = await createTestFile(
      tempDir,
      'ambiguous.txt',
      'aaa bbb aaa'
    );

    const result = await handleMultiEdit({
      file_path: filePath,
      edits: [{ old_string: 'aaa', new_string: 'xxx' }],
      backup: false,
    });

    expect(result.isError).toBe(true);

    const parsed = JSON.parse(result.content[0].text);
    // Error should mention multiple occurrences
    expect(parsed.success).toBe(false);

    // File must remain unchanged
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('aaa bbb aaa');
  });

  it('should handle path with spaces', async () => {
    const filePath = await createTestFile(
      tempDir,
      'file with spaces.txt',
      'hello'
    );

    const result = await handleMultiEdit({
      file_path: filePath,
      edits: [{ old_string: 'hello', new_string: 'goodbye' }],
      backup: false,
    });

    expect(result.isError).toBeFalsy();

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('goodbye');
  });
});
