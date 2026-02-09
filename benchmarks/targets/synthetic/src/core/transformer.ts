import type { TransformResult } from '../types.js';

export function transformData<T>(
  input: T,
  rules: string[],
): TransformResult<T> {
  const errors: string[] = [];
  const appliedRules: string[] = [];
  let current: unknown = input;

  for (const rule of rules) {
    const result = applyRule(current, rule);
    if (result.success) {
      current = result.data;
      appliedRules.push(rule);
    } else {
      errors.push(`Rule "${rule}" failed: ${result.error}`);
    }
  }

  return {
    success: errors.length === 0,
    data: current as T,
    errors,
    metadata: {
      rulesApplied: appliedRules,
      totalRules: rules.length,
      successRate:
        rules.length > 0 ? appliedRules.length / rules.length : 1,
    },
  };
}

function applyRule(
  data: unknown,
  rule: string,
): { success: boolean; data: unknown; error?: string } {
  switch (rule) {
    case 'uppercase':
      if (typeof data === 'string') {
        return { success: true, data: data.toUpperCase() };
      }
      return { success: false, data, error: 'Input is not a string' };

    case 'lowercase':
      if (typeof data === 'string') {
        return { success: true, data: data.toLowerCase() };
      }
      return { success: false, data, error: 'Input is not a string' };

    case 'trim':
      if (typeof data === 'string') {
        return { success: true, data: data.trim() };
      }
      return { success: false, data, error: 'Input is not a string' };

    case 'flatten':
      if (typeof data === 'object' && data !== null) {
        return { success: true, data: flattenObject(data as Record<string, unknown>) };
      }
      return { success: false, data, error: 'Input is not an object' };

    default:
      return { success: false, data, error: `Unknown rule: ${rule}` };
  }
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix = '',
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

export function chainTransforms<T>(
  input: T,
  transformers: Array<(data: T) => TransformResult<T>>,
): TransformResult<T> {
  let current = input;
  const allErrors: string[] = [];
  const allMetadata: Record<string, unknown> = {};

  for (let i = 0; i < transformers.length; i++) {
    const result = transformers[i](current);
    if (!result.success) {
      allErrors.push(...result.errors);
      break;
    }
    current = result.data;
    allMetadata[`step_${i}`] = result.metadata;
  }

  return {
    success: allErrors.length === 0,
    data: current,
    errors: allErrors,
    metadata: allMetadata,
  };
}
