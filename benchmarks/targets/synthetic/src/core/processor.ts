import type { ProcessorConfig, TransformResult } from '../types.js';
import { DEFAULT_CONFIG, DEFAULT_TIMEOUT, MAX_BATCH_SIZE } from '../config.js';
import { parseInput, detectFormat } from './parser.js';
import { transformData } from './transformer.js';
import { validateInput, validateConfig } from './validator.js';

export async function processInput(
  input: string,
  config: ProcessorConfig = DEFAULT_CONFIG,
): Promise<TransformResult<unknown>> {
  const configValidation = validateConfig(config);
  if (!configValidation.valid) {
    return {
      success: false,
      data: null,
      errors: configValidation.errors.map((e) => `Config error: ${e}`),
      metadata: { stage: 'validation', config },
    };
  }

  const format = detectFormat(input);
  const parsed = parseInput(input);

  const schemaRules = buildSchemaRules(format);
  const inputValidation = validateInput(parsed, schemaRules);
  if (!inputValidation.valid) {
    return {
      success: false,
      data: parsed,
      errors: inputValidation.errors,
      metadata: { stage: 'input-validation', format },
    };
  }

  const transformRules = selectTransformRules(format, config);
  const result = transformData(parsed, transformRules);

  return {
    ...result,
    metadata: {
      ...result.metadata,
      format,
      processingTimeout: config.timeout ?? DEFAULT_TIMEOUT,
      batchLimit: MAX_BATCH_SIZE,
    },
  };
}

function buildSchemaRules(format: string): string[] {
  const baseRules: string[] = [];

  switch (format) {
    case 'json':
      break;
    case 'csv':
      baseRules.push('required:headers', 'required:rows');
      break;
    default:
      baseRules.push('required:raw');
      break;
  }

  return baseRules;
}

function selectTransformRules(
  format: string,
  config: ProcessorConfig,
): string[] {
  const rules: string[] = [];

  if (format === 'json') {
    rules.push('flatten');
  }

  if (config.verbose) {
    rules.push('trim');
  }

  return rules;
}

export async function processBatch(
  inputs: string[],
  config: ProcessorConfig = DEFAULT_CONFIG,
): Promise<TransformResult<unknown>[]> {
  const limitedInputs = inputs.slice(0, MAX_BATCH_SIZE);
  const results: TransformResult<unknown>[] = [];

  for (const input of limitedInputs) {
    const result = await processInput(input, config);
    results.push(result);
  }

  return results;
}

export function getProcessorVersion(): string {
  return '1.0.0';
}
