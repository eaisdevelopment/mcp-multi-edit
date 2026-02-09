/**
 * Error path tests for tool handlers
 *
 * Tests error and rollback paths in multi-edit-files.ts, multi-edit.ts, and server.ts
 * using vi.spyOn on real temp files to trigger filesystem failures at specific moments.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleMultiEditFiles } from '../../src/tools/multi-edit-files.js';
import { handleMultiEdit } from '../../src/tools/multi-edit.js';
import * as editor from '../../src/core/editor.js';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { realpathSync } from 'node:fs';

// Helper: parse tool result JSON
const parse = (r: { content: Array<{ type: string; text: string }> }) =>
  JSON.parse(r.content[0].text);

let tempDir: string;

beforeEach(async () => {
  tempDir = realpathSync(await mkdtemp(join(tmpdir(), 'mcp-errpath-')));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(tempDir, { recursive: true, force: true });
});

// ============================================================
// handleMultiEditFiles error paths
// ============================================================

describe('handleMultiEditFiles error paths', () => {
  it('should handle read failure on file 2 of 3 with rollback of file 1', async () => {
    const file1 = join(tempDir, 'file1.txt');
    const file2 = join(tempDir, 'file2.txt');
    const file3 = join(tempDir, 'file3.txt');
    await writeFile(file1, 'alpha content', 'utf-8');
    await writeFile(file2, 'beta content', 'utf-8');
    await writeFile(file3, 'gamma content', 'utf-8');

    const originalRead = editor.readFileValidated;
    let callCount = 0;
    vi.spyOn(editor, 'readFileValidated').mockImplementation(async (path: string) => {
      callCount++;
      // First call is file1 read -- let it through
      // Second call is file2 read -- fail it
      // Any subsequent calls (rollback reading .bak) -- let them through
      if (callCount === 2) {
        throw Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
      }
      return originalRead(path);
    });

    const result = await handleMultiEditFiles({
      files: [
        { file_path: file1, edits: [{ old_string: 'alpha', new_string: 'ALPHA' }] },
        { file_path: file2, edits: [{ old_string: 'beta', new_string: 'BETA' }] },
        { file_path: file3, edits: [{ old_string: 'gamma', new_string: 'GAMMA' }] },
      ],
    });

    expect(result.isError).toBe(true);

    const parsed = parse(result);
    expect(parsed.error_code).toBe('FILE_NOT_FOUND');
    expect(parsed.message).toContain('file 2 of 3');

    // file_statuses should show file1 rolled_back, file2 failed, file3 skipped
    expect(parsed.file_statuses).toBeDefined();
    expect(parsed.file_statuses).toHaveLength(3);
    expect(parsed.file_statuses[0].status).toBe('rolled_back');
    expect(parsed.file_statuses[1].status).toBe('failed');
    expect(parsed.file_statuses[2].status).toBe('skipped');

    // rollback report should be present
    expect(parsed.rollback).toBeDefined();
    expect(parsed.rollback.files_rolled_back).toBe(1);
  });

  it('should handle backup failure on file 1', async () => {
    const file1 = join(tempDir, 'file1.txt');
    await writeFile(file1, 'content to backup', 'utf-8');

    vi.spyOn(editor, 'createBackup').mockRejectedValue(
      Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
    );

    const result = await handleMultiEditFiles({
      files: [
        { file_path: file1, edits: [{ old_string: 'content', new_string: 'CONTENT' }] },
      ],
    });

    expect(result.isError).toBe(true);

    const parsed = parse(result);
    expect(parsed.error_code).toBe('BACKUP_FAILED');
    expect(parsed.message).toContain('Backup failed');

    // No rollback since nothing was written yet
    expect(parsed.rollback).toBeUndefined();
  });

  it('should handle write failure on file 2 after file 1 succeeds and rollback', async () => {
    const file1 = join(tempDir, 'file1.txt');
    const file2 = join(tempDir, 'file2.txt');
    await writeFile(file1, 'first file', 'utf-8');
    await writeFile(file2, 'second file', 'utf-8');

    const originalWrite = editor.atomicWrite;
    let writeCount = 0;
    vi.spyOn(editor, 'atomicWrite').mockImplementation(async (path: string, content: string) => {
      writeCount++;
      if (writeCount === 1) {
        // First write (file1) succeeds
        return originalWrite(path, content);
      }
      // Second write (file2) fails -- but also rollback writes must succeed
      // The rollback calls atomicWrite too, so we need to let those through
      if (path === file2) {
        throw Object.assign(new Error('ENOSPC: no space left'), { code: 'ENOSPC' });
      }
      return originalWrite(path, content);
    });

    const result = await handleMultiEditFiles({
      files: [
        { file_path: file1, edits: [{ old_string: 'first', new_string: 'FIRST' }] },
        { file_path: file2, edits: [{ old_string: 'second', new_string: 'SECOND' }] },
      ],
    });

    expect(result.isError).toBe(true);

    const parsed = parse(result);
    expect(parsed.error_code).toBe('DISK_FULL');
    expect(parsed.message).toContain('file 2 of 2');

    // Rollback should have restored file1
    expect(parsed.rollback).toBeDefined();
    expect(parsed.rollback.files_rolled_back).toBe(1);

    // file_statuses: file1 rolled_back, file2 failed
    expect(parsed.file_statuses).toHaveLength(2);
    expect(parsed.file_statuses[0].status).toBe('rolled_back');
    expect(parsed.file_statuses[1].status).toBe('failed');
  });

  it('should handle unexpected exception in outer try/catch', async () => {
    const file1 = join(tempDir, 'file1.txt');
    await writeFile(file1, 'some content', 'utf-8');

    vi.spyOn(editor, 'applyEditsToContent').mockImplementation(() => {
      throw new TypeError('unexpected internal error');
    });

    const result = await handleMultiEditFiles({
      files: [
        { file_path: file1, edits: [{ old_string: 'some', new_string: 'SOME' }] },
      ],
    });

    expect(result.isError).toBe(true);

    const parsed = parse(result);
    expect(parsed.error_code).toBe('UNKNOWN_ERROR');
    expect(parsed.message).toContain('unexpected internal error');
  });

  it('should handle rollback failure when backup file is unreadable', async () => {
    const file1 = join(tempDir, 'file1.txt');
    const file2 = join(tempDir, 'file2.txt');
    await writeFile(file1, 'file one data', 'utf-8');
    await writeFile(file2, 'file two data', 'utf-8');

    const originalRead = editor.readFileValidated;
    const originalWrite = editor.atomicWrite;

    // We need: file1 read succeeds, file2 read succeeds,
    // file1 write succeeds, file2 write fails,
    // then rollback: reading file1.bak fails (rollback failure)
    let readCallCount = 0;
    vi.spyOn(editor, 'readFileValidated').mockImplementation(async (path: string) => {
      readCallCount++;
      // During rollback, readFileValidated is called to read the .bak file
      if (path.endsWith('.bak')) {
        throw new Error('Cannot read backup file');
      }
      return originalRead(path);
    });

    let writeCallCount = 0;
    vi.spyOn(editor, 'atomicWrite').mockImplementation(async (path: string, content: string) => {
      writeCallCount++;
      if (writeCallCount === 1) {
        // file1 write succeeds
        return originalWrite(path, content);
      }
      // file2 write fails
      throw Object.assign(new Error('ENOSPC: no space'), { code: 'ENOSPC' });
    });

    const result = await handleMultiEditFiles({
      files: [
        { file_path: file1, edits: [{ old_string: 'file one', new_string: 'FILE ONE' }] },
        { file_path: file2, edits: [{ old_string: 'file two', new_string: 'FILE TWO' }] },
      ],
    });

    expect(result.isError).toBe(true);

    const parsed = parse(result);
    // Rollback should report failure
    expect(parsed.rollback).toBeDefined();
    expect(parsed.rollback.files_failed_rollback).toBe(1);
    expect(parsed.rollback.details[0].status).toBe('failed');
    expect(parsed.rollback.details[0].error).toContain('Cannot read backup file');
  });

  it('should classify ambiguous match error code from message', async () => {
    const file1 = join(tempDir, 'dup.txt');
    // Create a file with duplicate content to trigger ambiguous match
    await writeFile(file1, 'aaa bbb aaa', 'utf-8');

    const result = await handleMultiEditFiles({
      files: [
        {
          file_path: file1,
          edits: [{ old_string: 'aaa', new_string: 'xxx' }], // matches twice without replace_all
        },
      ],
    });

    expect(result.isError).toBe(true);

    const parsed = parse(result);
    expect(parsed.error_code).toBe('AMBIGUOUS_MATCH');
  });

  it('should classify encoding error code from message', async () => {
    const file1 = join(tempDir, 'enc.txt');
    await writeFile(file1, 'valid content', 'utf-8');

    // applyEditsToContent returning a result with encoding-related error
    vi.spyOn(editor, 'applyEditsToContent').mockReturnValue({
      success: false,
      file_path: file1,
      edits_applied: 0,
      results: [],
      error: 'File contains invalid UTF-8 encoding',
      dry_run: false,
    });

    const result = await handleMultiEditFiles({
      files: [
        { file_path: file1, edits: [{ old_string: 'valid', new_string: 'VALID' }] },
      ],
    });

    expect(result.isError).toBe(true);

    const parsed = parse(result);
    expect(parsed.error_code).toBe('INVALID_ENCODING');
  });

  it('should classify unknown error code for unrecognized message', async () => {
    const file1 = join(tempDir, 'unknown.txt');
    await writeFile(file1, 'valid content', 'utf-8');

    vi.spyOn(editor, 'applyEditsToContent').mockReturnValue({
      success: false,
      file_path: file1,
      edits_applied: 0,
      results: [],
      error: 'something completely unknown happened',
      dry_run: false,
    });

    const result = await handleMultiEditFiles({
      files: [
        { file_path: file1, edits: [{ old_string: 'valid', new_string: 'VALID' }] },
      ],
    });

    expect(result.isError).toBe(true);

    const parsed = parse(result);
    expect(parsed.error_code).toBe('UNKNOWN_ERROR');
  });

  it('should show skipped files in file_statuses when failure is on first file', async () => {
    const file1 = join(tempDir, 'first.txt');
    const file2 = join(tempDir, 'second.txt');
    const file3 = join(tempDir, 'third.txt');
    await writeFile(file1, 'alpha', 'utf-8');
    await writeFile(file2, 'beta', 'utf-8');
    await writeFile(file3, 'gamma', 'utf-8');

    // Make backup fail on first file so nothing gets written
    vi.spyOn(editor, 'createBackup').mockRejectedValue(
      new Error('backup disk error')
    );

    const result = await handleMultiEditFiles({
      files: [
        { file_path: file1, edits: [{ old_string: 'alpha', new_string: 'ALPHA' }] },
        { file_path: file2, edits: [{ old_string: 'beta', new_string: 'BETA' }] },
        { file_path: file3, edits: [{ old_string: 'gamma', new_string: 'GAMMA' }] },
      ],
    });

    expect(result.isError).toBe(true);

    const parsed = parse(result);
    // file1 failed, file2 and file3 skipped
    expect(parsed.file_statuses).toHaveLength(3);
    expect(parsed.file_statuses[0].status).toBe('failed');
    expect(parsed.file_statuses[1].status).toBe('skipped');
    expect(parsed.file_statuses[2].status).toBe('skipped');
  });
});

// ============================================================
// handleMultiEdit error paths
// ============================================================

describe('handleMultiEdit error paths', () => {
  it('should catch unexpected error from applyEdits and return UNKNOWN_ERROR', async () => {
    const filePath = join(tempDir, 'test.txt');
    await writeFile(filePath, 'hello world', 'utf-8');

    vi.spyOn(editor, 'applyEdits').mockRejectedValue(
      new Error('unexpected kaboom')
    );

    const result = await handleMultiEdit({
      file_path: filePath,
      edits: [{ old_string: 'hello', new_string: 'goodbye' }],
    });

    expect(result.isError).toBe(true);

    const parsed = parse(result);
    expect(parsed.error_code).toBe('UNKNOWN_ERROR');
    expect(parsed.message).toContain('unexpected kaboom');
    expect(parsed.file_path).toBe(filePath);
  });

  it('should catch EACCES error from applyEdits and return PERMISSION_DENIED', async () => {
    const filePath = join(tempDir, 'test2.txt');
    await writeFile(filePath, 'hello world', 'utf-8');

    vi.spyOn(editor, 'applyEdits').mockRejectedValue(
      Object.assign(new Error('permission denied'), { code: 'EACCES' })
    );

    const result = await handleMultiEdit({
      file_path: filePath,
      edits: [{ old_string: 'hello', new_string: 'goodbye' }],
    });

    expect(result.isError).toBe(true);

    const parsed = parse(result);
    expect(parsed.error_code).toBe('PERMISSION_DENIED');
    expect(parsed.file_path).toBe(filePath);
  });
});

// ============================================================
// server.ts handler catch block
// ============================================================

describe('server.ts handler catch block', () => {
  it('should catch handler exceptions and return ErrorEnvelope via MCP', async () => {
    // Dynamically mock multi-edit to throw, then re-import server
    vi.doMock('../../src/tools/multi-edit.js', () => ({
      handleMultiEdit: vi.fn().mockRejectedValue(new Error('handler exploded')),
    }));

    // Must also provide multi-edit-files mock to avoid import issues
    vi.doMock('../../src/tools/multi-edit-files.js', () => ({
      handleMultiEditFiles: vi.fn(),
    }));

    const { createServer } = await import('../../src/server.js');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');

    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    const client = new Client(
      { name: 'error-test-client', version: '1.0.0' },
      {}
    );
    await client.connect(clientTransport);

    try {
      const result = await client.callTool({
        name: 'multi_edit',
        arguments: {
          file_path: '/tmp/test.txt',
          edits: [{ old_string: 'a', new_string: 'b' }],
        },
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      const parsed = JSON.parse(text);

      expect(result.isError).toBe(true);
      expect(parsed.error_code).toBe('UNKNOWN_ERROR');
      expect(parsed.message).toContain('handler exploded');
    } finally {
      await clientTransport.close();
      vi.doUnmock('../../src/tools/multi-edit.js');
      vi.doUnmock('../../src/tools/multi-edit-files.js');
    }
  });
});
