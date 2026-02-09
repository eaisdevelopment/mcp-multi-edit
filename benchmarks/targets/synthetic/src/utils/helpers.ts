import type { TransformResult } from '../types.js';

export function formatOutput(result: TransformResult<unknown>): string {
  if (!result.success) {
    const errorList = result.errors.map((e) => `  - ${e}`).join('\n');
    return `Error:\n${errorList}`;
  }

  const dataStr =
    typeof result.data === 'string'
      ? result.data
      : JSON.stringify(result.data, null, 2);

  const metaEntries = Object.entries(result.metadata);
  const metaStr =
    metaEntries.length > 0
      ? `\nMetadata:\n${metaEntries.map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join('\n')}`
      : '';

  return `${dataStr}${metaStr}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

export function truncateString(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return input.substring(0, maxLength - 3) + '...';
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function mergeResults<T>(
  results: TransformResult<T>[],
): TransformResult<T[]> {
  const allData = results.map((r) => r.data);
  const allErrors = results.flatMap((r) => r.errors);
  const mergedMetadata: Record<string, unknown> = {};

  results.forEach((r, index) => {
    mergedMetadata[`result_${index}`] = r.metadata;
  });

  return {
    success: allErrors.length === 0,
    data: allData,
    errors: allErrors,
    metadata: {
      ...mergedMetadata,
      totalResults: results.length,
      successCount: results.filter((r) => r.success).length,
    },
  };
}
