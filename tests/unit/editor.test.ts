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

// TODO: Add tests for applyEdits when implemented
