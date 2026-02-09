/**
 * MCP protocol integration tests
 *
 * Tests the full MCP Client -> InMemoryTransport -> Server -> Handler -> real filesystem path.
 * Uses temp directories for all file operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  createTestClient,
  createTempDir,
  createTestFile,
  cleanupTempDir,
  parseToolResult,
} from './helpers/setup.js';

describe('MCP Server Integration', () => {
  let client: Client;
  let cleanup: () => Promise<void>;
  let tempDir: string;

  beforeEach(async () => {
    ({ client, cleanup } = await createTestClient());
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanup();
    await cleanupTempDir(tempDir);
  });

  // ============================================================
  // Tool Discovery
  // ============================================================

  describe('tool discovery', () => {
    it('should list both tools', async () => {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(2);
      const names = tools.map(t => t.name);
      expect(names).toContain('multi_edit');
      expect(names).toContain('multi_edit_files');
    });

    it('should expose correct input schema for multi_edit', async () => {
      const { tools } = await client.listTools();
      const multiEdit = tools.find(t => t.name === 'multi_edit')!;
      expect(multiEdit).toBeDefined();
      expect(multiEdit.inputSchema.required).toContain('file_path');
      expect(multiEdit.inputSchema.required).toContain('edits');
    });

    it('should expose correct input schema for multi_edit_files', async () => {
      const { tools } = await client.listTools();
      const multiEditFiles = tools.find(t => t.name === 'multi_edit_files')!;
      expect(multiEditFiles).toBeDefined();
      expect(multiEditFiles.inputSchema.required).toContain('files');
    });
  });

  // ============================================================
  // multi_edit tool
  // ============================================================

  describe('multi_edit tool', () => {
    it('should apply single edit and modify file on disk', async () => {
      const filePath = await createTestFile(tempDir, 'test.txt', 'hello world');

      const result = await client.callTool({
        name: 'multi_edit',
        arguments: {
          file_path: filePath,
          edits: [{ old_string: 'hello', new_string: 'goodbye' }],
          backup: false,
        },
      });

      const { parsed, isError } = parseToolResult(result);
      expect(isError).toBeFalsy();
      expect(parsed.success).toBe(true);
      expect(parsed.edits_applied).toBe(1);

      // Verify file was actually modified on disk
      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('goodbye world');
    });

    it('should apply multiple edits sequentially', async () => {
      const filePath = await createTestFile(tempDir, 'multi.txt', 'aaa bbb ccc');

      const result = await client.callTool({
        name: 'multi_edit',
        arguments: {
          file_path: filePath,
          edits: [
            { old_string: 'aaa', new_string: 'xxx' },
            { old_string: 'bbb', new_string: 'yyy' },
          ],
          backup: false,
        },
      });

      const { parsed, isError } = parseToolResult(result);
      expect(isError).toBeFalsy();
      expect(parsed.success).toBe(true);
      expect(parsed.edits_applied).toBe(2);

      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('xxx yyy ccc');
    });

    it('should support dry_run mode without modifying file', async () => {
      const filePath = await createTestFile(tempDir, 'dry.txt', 'original');

      const result = await client.callTool({
        name: 'multi_edit',
        arguments: {
          file_path: filePath,
          edits: [{ old_string: 'original', new_string: 'modified' }],
          dry_run: true,
          backup: false,
        },
      });

      const { parsed, isError } = parseToolResult(result);
      expect(isError).toBeFalsy();
      expect(parsed.success).toBe(true);

      // File must remain unchanged on disk
      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('original');
    });

    it('should create backup file when backup is true', async () => {
      const filePath = await createTestFile(tempDir, 'backup-test.txt', 'before edit');

      const result = await client.callTool({
        name: 'multi_edit',
        arguments: {
          file_path: filePath,
          edits: [{ old_string: 'before', new_string: 'after' }],
          backup: true,
        },
      });

      const { parsed, isError } = parseToolResult(result);
      expect(isError).toBeFalsy();
      expect(parsed.success).toBe(true);

      // Verify original file is modified
      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('after edit');

      // Verify .bak file exists with original content
      const files = await readdir(tempDir);
      const bakFile = files.find(f => f.endsWith('.bak'));
      expect(bakFile).toBeDefined();

      const bakContent = await readFile(join(tempDir, bakFile!), 'utf-8');
      expect(bakContent).toBe('before edit');
    });

    it('should return error for non-existent file', async () => {
      const fakePath = join(tempDir, 'nonexistent.txt');

      const result = await client.callTool({
        name: 'multi_edit',
        arguments: {
          file_path: fakePath,
          edits: [{ old_string: 'a', new_string: 'b' }],
          backup: false,
        },
      });

      const { parsed, isError } = parseToolResult(result);
      expect(isError).toBe(true);
      expect(parsed.error_code).toBe('VALIDATION_FAILED');
    });

    it('should return error when old_string not found', async () => {
      const filePath = await createTestFile(tempDir, 'nomatch.txt', 'hello world');

      const result = await client.callTool({
        name: 'multi_edit',
        arguments: {
          file_path: filePath,
          edits: [{ old_string: 'missing_string', new_string: 'replacement' }],
          backup: false,
        },
      });

      const { parsed, isError } = parseToolResult(result);
      expect(isError).toBe(true);
      // The error may manifest as MATCH_NOT_FOUND in the parsed response
      // or as a general error with relevant message
      expect(parsed.success).toBe(false);
    });

    it('should return error for unknown tool name', async () => {
      const result = await client.callTool({
        name: 'nonexistent_tool',
        arguments: {},
      });

      const { parsed, isError } = parseToolResult(result);
      expect(isError).toBe(true);
      expect(parsed.error_code).toBe('UNKNOWN_TOOL');
    });
  });

  // ============================================================
  // multi_edit_files tool
  // ============================================================

  describe('multi_edit_files tool', () => {
    it('should edit multiple files successfully', async () => {
      const file1 = await createTestFile(tempDir, 'file1.txt', 'aaa');
      const file2 = await createTestFile(tempDir, 'file2.txt', 'bbb');

      const result = await client.callTool({
        name: 'multi_edit_files',
        arguments: {
          files: [
            {
              file_path: file1,
              edits: [{ old_string: 'aaa', new_string: 'xxx' }],
            },
            {
              file_path: file2,
              edits: [{ old_string: 'bbb', new_string: 'yyy' }],
            },
          ],
        },
      });

      const { parsed, isError } = parseToolResult(result);
      expect(isError).toBeFalsy();
      expect(parsed.success).toBe(true);

      // Verify both files modified on disk
      const content1 = await readFile(file1, 'utf-8');
      expect(content1).toBe('xxx');

      const content2 = await readFile(file2, 'utf-8');
      expect(content2).toBe('yyy');
    });

    it('should rollback all files when one fails', async () => {
      const file1 = await createTestFile(tempDir, 'file1.txt', 'aaa');
      const file2 = await createTestFile(tempDir, 'file2.txt', 'bbb');

      // File2 edit will fail because old_string 'nonexistent_string' is not in the file.
      // File1 edit succeeds first, then file2 failure triggers rollback of file1.
      const result = await client.callTool({
        name: 'multi_edit_files',
        arguments: {
          files: [
            {
              file_path: file1,
              edits: [{ old_string: 'aaa', new_string: 'xxx' }],
            },
            {
              file_path: file2,
              edits: [{ old_string: 'nonexistent_string', new_string: 'else' }],
            },
          ],
        },
      });

      const { parsed, isError } = parseToolResult(result);
      expect(isError).toBe(true);

      // File 1 should be rolled back to original content
      const content1 = await readFile(file1, 'utf-8');
      expect(content1).toBe('aaa');

      // Response should contain rollback information
      expect(parsed.rollback).toBeDefined();
    });

    it('should support dry_run for multi-file', async () => {
      const file1 = await createTestFile(tempDir, 'file1.txt', 'alpha');
      const file2 = await createTestFile(tempDir, 'file2.txt', 'beta');

      const result = await client.callTool({
        name: 'multi_edit_files',
        arguments: {
          files: [
            {
              file_path: file1,
              edits: [{ old_string: 'alpha', new_string: 'ALPHA' }],
            },
            {
              file_path: file2,
              edits: [{ old_string: 'beta', new_string: 'BETA' }],
            },
          ],
          dry_run: true,
        },
      });

      const { parsed, isError } = parseToolResult(result);
      expect(isError).toBeFalsy();
      expect(parsed.success).toBe(true);

      // Both files must remain unchanged on disk
      const content1 = await readFile(file1, 'utf-8');
      expect(content1).toBe('alpha');

      const content2 = await readFile(file2, 'utf-8');
      expect(content2).toBe('beta');
    });
  });
});
