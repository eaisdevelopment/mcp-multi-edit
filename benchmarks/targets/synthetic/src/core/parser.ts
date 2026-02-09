import type { TransformResult } from '../types.js';

export function parseInput(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseJson(trimmed);
  }

  if (trimmed.includes(',') && trimmed.includes('\n')) {
    return parseCsv(trimmed);
  }

  return { raw: trimmed, format: 'text' };
}

function parseJson(input: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(input);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed, format: 'json' };
  } catch {
    return { error: 'Invalid JSON', raw: input, format: 'json' };
  }
}

function parseCsv(input: string): Record<string, unknown> {
  const lines = input.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { rows: [], headers: [], format: 'csv' };
  }

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });

  return { rows, headers, format: 'csv' };
}

export function detectFormat(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.includes(',') && trimmed.includes('\n')) return 'csv';
  return 'text';
}

export function createEmptyResult<T>(data: T): TransformResult<T> {
  return {
    success: true,
    data,
    errors: [],
    metadata: { source: 'parser', timestamp: Date.now() },
  };
}
