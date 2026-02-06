/**
 * Unit tests for editor.ts
 */

import { describe, it, expect } from 'vitest';
import { findOccurrences, replaceString } from '../../src/core/editor.js';

describe('findOccurrences', () => {
  it('should find single occurrence', () => {
    const content = 'hello world';
    expect(findOccurrences(content, 'world')).toBe(1);
  });

  it('should find multiple occurrences', () => {
    const content = 'foo bar foo baz foo';
    expect(findOccurrences(content, 'foo')).toBe(3);
  });

  it('should return 0 for no matches', () => {
    const content = 'hello world';
    expect(findOccurrences(content, 'xyz')).toBe(0);
  });

  it('should return 0 for empty search string', () => {
    const content = 'hello world';
    expect(findOccurrences(content, '')).toBe(0);
  });

  it('should handle overlapping patterns correctly', () => {
    const content = 'aaa';
    expect(findOccurrences(content, 'aa')).toBe(1); // Non-overlapping count
  });
});

describe('replaceString', () => {
  it('should replace single occurrence by default', () => {
    const content = 'foo bar foo';
    const result = replaceString(content, 'foo', 'baz');
    expect(result.content).toBe('baz bar foo');
    expect(result.replacedCount).toBe(1);
  });

  it('should replace all occurrences when replaceAll is true', () => {
    const content = 'foo bar foo';
    const result = replaceString(content, 'foo', 'baz', true);
    expect(result.content).toBe('baz bar baz');
    expect(result.replacedCount).toBe(2);
  });

  it('should return unchanged content when no match', () => {
    const content = 'hello world';
    const result = replaceString(content, 'xyz', 'abc');
    expect(result.content).toBe('hello world');
    expect(result.replacedCount).toBe(0);
  });

  it('should handle empty old_string', () => {
    const content = 'hello world';
    const result = replaceString(content, '', 'abc');
    expect(result.content).toBe('hello world');
    expect(result.replacedCount).toBe(0);
  });

  it('should handle replacing with empty string', () => {
    const content = 'hello world';
    const result = replaceString(content, 'world', '');
    expect(result.content).toBe('hello ');
    expect(result.replacedCount).toBe(1);
  });

  it('should handle multiline content', () => {
    const content = 'line1\nline2\nline1';
    const result = replaceString(content, 'line1', 'replaced', true);
    expect(result.content).toBe('replaced\nline2\nreplaced');
    expect(result.replacedCount).toBe(2);
  });
});

describe('applyEdits', () => {
  // Helper to create a mock file content for testing
  // Note: applyEdits will eventually read from file, but for unit testing
  // we use applyEditsToContent which takes content directly

  it('should return success with empty results for empty edits array', async () => {
    const { applyEditsToContent } = await import('../../src/core/editor.js');
    const content = 'hello';
    const result = applyEditsToContent('test.txt', content, []);

    expect(result.success).toBe(true);
    expect(result.edits_applied).toBe(0);
    expect(result.results).toEqual([]);
    expect(result.dry_run).toBe(false);
  });

  it('should successfully replace a single occurrence', async () => {
    const { applyEditsToContent } = await import('../../src/core/editor.js');
    const content = 'hello world';
    const result = applyEditsToContent('test.txt', content, [
      { old_string: 'world', new_string: 'there' }
    ]);

    expect(result.success).toBe(true);
    expect(result.edits_applied).toBe(1);
    expect(result.results[0].replaced).toBe(1);
    expect(result.results[0].success).toBe(true);
  });

  it('should return error when old_string not found', async () => {
    const { applyEditsToContent } = await import('../../src/core/editor.js');
    const content = 'hello world';
    const result = applyEditsToContent('test.txt', content, [
      { old_string: 'xyz', new_string: 'abc' }
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(result.failed_edit_index).toBe(0);
  });

  it('should return error with line numbers for non-unique match without replace_all', async () => {
    const { applyEditsToContent } = await import('../../src/core/editor.js');
    const content = 'foo bar foo';
    const result = applyEditsToContent('test.txt', content, [
      { old_string: 'foo', new_string: 'baz' }
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Found 2 matches');
    expect(result.error).toMatch(/lines?\s+1/i);
    expect(result.failed_edit_index).toBe(0);
  });

  it('should succeed with replace_all for multiple matches', async () => {
    const { applyEditsToContent } = await import('../../src/core/editor.js');
    const content = 'foo bar foo';
    const result = applyEditsToContent('test.txt', content, [
      { old_string: 'foo', new_string: 'baz', replace_all: true }
    ]);

    expect(result.success).toBe(true);
    expect(result.results[0].replaced).toBe(2);
    expect(result.results[0].success).toBe(true);
  });

  it('should apply edits sequentially - later edits see results of earlier', async () => {
    const { applyEditsToContent } = await import('../../src/core/editor.js');
    const content = 'hello world';
    const result = applyEditsToContent('test.txt', content, [
      { old_string: 'world', new_string: 'there' },
      { old_string: 'there', new_string: 'you' }
    ]);

    expect(result.success).toBe(true);
    expect(result.edits_applied).toBe(2);
    expect(result.final_content).toBe('hello you');
  });

  it('should allow no-op edit where old_string equals new_string', async () => {
    const { applyEditsToContent } = await import('../../src/core/editor.js');
    const content = 'hello';
    const result = applyEditsToContent('test.txt', content, [
      { old_string: 'hello', new_string: 'hello' }
    ]);

    expect(result.success).toBe(true);
    expect(result.results[0].replaced).toBe(0);
    expect(result.results[0].success).toBe(true);
  });

  it('should stop processing at first failure', async () => {
    const { applyEditsToContent } = await import('../../src/core/editor.js');
    const content = 'hello';
    const result = applyEditsToContent('test.txt', content, [
      { old_string: 'xyz', new_string: 'a' },
      { old_string: 'hello', new_string: 'b' }
    ]);

    expect(result.success).toBe(false);
    expect(result.failed_edit_index).toBe(0);
    expect(result.edits_applied).toBe(0);
  });

  it('should report line numbers in error for multiline non-unique matches', async () => {
    const { applyEditsToContent } = await import('../../src/core/editor.js');
    const content = 'foo\nbar\nfoo';
    const result = applyEditsToContent('test.txt', content, [
      { old_string: 'foo', new_string: 'x' }
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('lines 1, 3');
  });

  it('should support case-insensitive matching', async () => {
    const { applyEditsToContent } = await import('../../src/core/editor.js');
    const content = 'Hello World';
    const result = applyEditsToContent('test.txt', content, [
      { old_string: 'hello', new_string: 'hi', case_insensitive: true }
    ]);

    expect(result.success).toBe(true);
    expect(result.results[0].replaced).toBe(1);
    expect(result.final_content).toBe('hi World');
  });
});

describe('applyEdits file I/O', () => {
  // Import dependencies for file I/O tests
  const fs = require('fs/promises');
  const path = require('path');
  const os = require('os');

  // Helper to create a temporary file
  async function createTempFile(content: string): Promise<string> {
    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
    await fs.writeFile(tempPath, content, 'utf8');
    return tempPath;
  }

  // Helper to create a file with invalid UTF-8
  async function createInvalidUtf8File(): Promise<string> {
    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, `test-invalid-${Date.now()}.txt`);
    // Invalid UTF-8 sequence: 0xFF 0xFE followed by valid text
    const invalidBytes = Buffer.from([0xFF, 0xFE, 0x68, 0x65, 0x6c, 0x6c, 0x6f]);
    await fs.writeFile(tempPath, invalidBytes);
    return tempPath;
  }

  // Cleanup helper - also removes .bak backup files
  async function cleanupFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore if already deleted
    }
    try {
      await fs.unlink(`${filePath}.bak`);
    } catch {
      // Ignore if no backup file
    }
  }

  it('should read file and apply edits successfully', async () => {
    const { applyEdits } = await import('../../src/core/editor.js');
    const tempPath = await createTempFile('hello world');

    try {
      const result = await applyEdits(tempPath, [
        { old_string: 'world', new_string: 'there' }
      ]);

      expect(result.success).toBe(true);
      expect(result.edits_applied).toBe(1);

      // Verify file was actually modified
      const content = await fs.readFile(tempPath, 'utf8');
      expect(content).toBe('hello there');
    } finally {
      await cleanupFile(tempPath);
    }
  });

  it('should return error with recovery hint for file not found', async () => {
    const { applyEdits } = await import('../../src/core/editor.js');
    const nonexistentPath = '/nonexistent/path/to/file.txt';

    const result = await applyEdits(nonexistentPath, [
      { old_string: 'a', new_string: 'b' }
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('File not found');
    expect(result.error).toContain('Check that file exists');
  });

  it('should return clear error for invalid UTF-8 encoding', async () => {
    const { applyEdits } = await import('../../src/core/editor.js');
    const tempPath = await createInvalidUtf8File();

    try {
      const result = await applyEdits(tempPath, [
        { old_string: 'hello', new_string: 'hi' }
      ]);

      expect(result.success).toBe(false);
      expect(result.error?.toLowerCase()).toContain('utf-8');
    } finally {
      await cleanupFile(tempPath);
    }
  });

  it('should leave file unchanged on validation failure (atomic)', async () => {
    const { applyEdits } = await import('../../src/core/editor.js');
    const originalContent = 'hello';
    const tempPath = await createTempFile(originalContent);

    try {
      // This edit will fail because 'xyz' is not in the file
      const result = await applyEdits(tempPath, [
        { old_string: 'xyz', new_string: 'abc' }
      ]);

      expect(result.success).toBe(false);

      // Verify original file is unchanged
      const content = await fs.readFile(tempPath, 'utf8');
      expect(content).toBe(originalContent);
    } finally {
      await cleanupFile(tempPath);
    }
  });

  it('should not modify file in dry run mode', async () => {
    const { applyEdits } = await import('../../src/core/editor.js');
    const originalContent = 'hello world';
    const tempPath = await createTempFile(originalContent);

    try {
      const result = await applyEdits(tempPath, [
        { old_string: 'world', new_string: 'there' }
      ], true); // dry_run = true

      expect(result.success).toBe(true);
      expect(result.dry_run).toBe(true);
      expect(result.final_content).toBe('hello there');

      // Verify original file is unchanged
      const content = await fs.readFile(tempPath, 'utf8');
      expect(content).toBe(originalContent);
    } finally {
      await cleanupFile(tempPath);
    }
  });

  it('should clean up temp files on error', async () => {
    const { applyEdits } = await import('../../src/core/editor.js');
    const tempPath = await createTempFile('hello');
    const tempDir = path.dirname(tempPath);

    try {
      // First, verify the file exists
      await fs.access(tempPath);

      // Apply a failing edit (non-existent string)
      await applyEdits(tempPath, [
        { old_string: 'nonexistent', new_string: 'replacement' }
      ]);

      // Check no .tmp files remain in the directory
      const files = await fs.readdir(tempDir);
      const tmpFiles = files.filter((f: string) => f.endsWith('.tmp'));

      // Filter to only files that match our test pattern
      const relevantTmpFiles = tmpFiles.filter((f: string) =>
        f.includes('test-') || f.includes(path.basename(tempPath))
      );

      expect(relevantTmpFiles.length).toBe(0);
    } finally {
      await cleanupFile(tempPath);
    }
  });

  it('should use same directory for temp file (atomic rename compatibility)', async () => {
    const { applyEdits } = await import('../../src/core/editor.js');
    const tempPath = await createTempFile('hello world');

    try {
      // This should succeed without EXDEV errors
      const result = await applyEdits(tempPath, [
        { old_string: 'world', new_string: 'universe' }
      ]);

      expect(result.success).toBe(true);

      // Verify content was changed
      const content = await fs.readFile(tempPath, 'utf8');
      expect(content).toBe('hello universe');
    } finally {
      await cleanupFile(tempPath);
    }
  });

  it('should return clear error for permission denied', async () => {
    const { applyEdits } = await import('../../src/core/editor.js');
    const tempDir = os.tmpdir();
    const readOnlyDir = path.join(tempDir, `test-readonly-${Date.now()}`);
    const tempPath = path.join(readOnlyDir, 'test.txt');

    try {
      // Create a read-only directory with a file inside
      await fs.mkdir(readOnlyDir);
      await fs.writeFile(tempPath, 'hello', 'utf8');
      // Make directory read-only (prevents creating temp file for atomic write)
      await fs.chmod(readOnlyDir, 0o555);

      const result = await applyEdits(tempPath, [
        { old_string: 'hello', new_string: 'hi' }
      ]);

      expect(result.success).toBe(false);
      // Error should mention permission or be actionable
      expect(result.error?.toLowerCase()).toMatch(/permission|denied|eacces|eperm/);
    } finally {
      // Restore permissions before cleanup
      try {
        await fs.chmod(readOnlyDir, 0o755);
        await fs.unlink(tempPath);
        await fs.rmdir(readOnlyDir);
      } catch {
        // Ignore cleanup errors
      }
    }
  });
});
