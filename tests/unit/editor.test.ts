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
})
