import type { ProcessorConfig, TransformResult, HandlerResult } from '../types.js';
import { formatOutput, truncateString } from '../utils/helpers.js';
import { DEFAULT_CONFIG } from '../config.js';
import { processInput } from '../core/processor.js';

const MAX_OUTPUT_LENGTH = 50_000;

export async function handleOutput(
  result: TransformResult<unknown>,
  config: ProcessorConfig = DEFAULT_CONFIG,
): Promise<HandlerResult> {
  try {
    const formatted = formatResult(result, config);
    const output = truncateString(formatted, MAX_OUTPUT_LENGTH);

    return {
      status: 'ok',
      message: output,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Output formatting failed: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: Date.now(),
    };
  }
}

export async function reprocessAndFormat(
  raw: string,
  config: ProcessorConfig = DEFAULT_CONFIG,
): Promise<HandlerResult> {
  const result = await processInput(raw, config);
  return handleOutput(result, config);
}

function formatResult(
  result: TransformResult<unknown>,
  config: ProcessorConfig,
): string {
  switch (config.outputFormat) {
    case 'json':
      return formatAsJson(result);
    case 'csv':
      return formatAsCsv(result);
    case 'xml':
      return formatAsXml(result);
    default:
      return formatOutput(result);
  }
}

function formatAsJson(result: TransformResult<unknown>): string {
  return JSON.stringify(
    {
      success: result.success,
      data: result.data,
      errors: result.errors,
      metadata: result.metadata,
    },
    null,
    2,
  );
}

function formatAsCsv(result: TransformResult<unknown>): string {
  if (!result.success) {
    return `error,${result.errors.join('; ')}`;
  }

  if (typeof result.data === 'object' && result.data !== null) {
    const obj = result.data as Record<string, unknown>;
    const headers = Object.keys(obj).join(',');
    const values = Object.values(obj)
      .map((v) => String(v))
      .join(',');
    return `${headers}\n${values}`;
  }

  return String(result.data);
}

function formatAsXml(result: TransformResult<unknown>): string {
  const status = result.success ? 'success' : 'error';
  const dataStr =
    typeof result.data === 'string'
      ? result.data
      : JSON.stringify(result.data);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<result status="${status}">`,
    `  <data>${escapeXml(dataStr)}</data>`,
    result.errors.length > 0
      ? `  <errors>${result.errors.map((e) => `<error>${escapeXml(e)}</error>`).join('')}</errors>`
      : '  <errors/>',
    '</result>',
  ].join('\n');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
