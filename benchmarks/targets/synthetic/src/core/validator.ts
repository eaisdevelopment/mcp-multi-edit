import type { ProcessorConfig, TransformResult } from '../types.js';

export function validateInput(
  data: Record<string, unknown>,
  schema: string[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const rule of schema) {
    const error = checkRule(data, rule);
    if (error) {
      errors.push(error);
    }
  }

  return { valid: errors.length === 0, errors };
}

function checkRule(data: Record<string, unknown>, rule: string): string | null {
  const parts = rule.split(':');
  if (parts.length < 2) {
    return `Invalid schema rule format: "${rule}"`;
  }

  const [ruleType, field] = parts;

  switch (ruleType) {
    case 'required':
      if (!(field in data) || data[field] === undefined || data[field] === null) {
        return `Field "${field}" is required`;
      }
      return null;

    case 'string':
      if (field in data && typeof data[field] !== 'string') {
        return `Field "${field}" must be a string`;
      }
      return null;

    case 'number':
      if (field in data && typeof data[field] !== 'number') {
        return `Field "${field}" must be a number`;
      }
      return null;

    case 'boolean':
      if (field in data && typeof data[field] !== 'boolean') {
        return `Field "${field}" must be a boolean`;
      }
      return null;

    default:
      return `Unknown validation rule type: "${ruleType}"`;
  }
}

export function validateConfig(config: ProcessorConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.maxRetries < 0) {
    errors.push('maxRetries must be non-negative');
  }

  if (config.timeout <= 0) {
    errors.push('timeout must be positive');
  }

  const validFormats = ['json', 'csv', 'xml'];
  if (!validFormats.includes(config.outputFormat)) {
    errors.push(`outputFormat must be one of: ${validFormats.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateResult<T>(
  result: TransformResult<T>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (result.success && result.errors.length > 0) {
    errors.push('Result marked as success but contains errors');
  }

  if (!result.success && result.errors.length === 0) {
    errors.push('Result marked as failure but contains no errors');
  }

  if (result.data === undefined) {
    errors.push('Result data is undefined');
  }

  return { valid: errors.length === 0, errors };
}
