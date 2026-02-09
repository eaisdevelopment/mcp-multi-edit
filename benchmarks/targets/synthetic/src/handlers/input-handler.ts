import type { ProcessorConfig, HandlerResult } from '../types.js';
import { processInput } from '../core/processor.js';
import { DEFAULT_TIMEOUT } from '../config.js';
import { generateId } from '../utils/helpers.js';
import { ProcessingError } from '../utils/errors.js';

export async function handleInput(
  raw: string,
  config: ProcessorConfig,
): Promise<HandlerResult> {
  const requestId = generateId();
  const startTime = Date.now();
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;

  if (!raw || raw.trim().length === 0) {
    return {
      status: 'error',
      message: `[${requestId}] Empty input received`,
      timestamp: Date.now(),
    };
  }

  try {
    const result = await Promise.race([
      processInput(raw, config),
      createTimeout(timeout),
    ]);

    if (result === null) {
      return {
        status: 'error',
        message: `[${requestId}] Processing timed out after ${timeout}ms`,
        timestamp: Date.now(),
      };
    }

    const duration = Date.now() - startTime;

    if (result.success) {
      return {
        status: 'ok',
        message: `[${requestId}] Processed successfully in ${duration}ms`,
        timestamp: Date.now(),
      };
    }

    return {
      status: 'error',
      message: `[${requestId}] Processing failed: ${result.errors.join(', ')}`,
      timestamp: Date.now(),
    };
  } catch (error) {
    if (error instanceof ProcessingError) {
      return {
        status: 'error',
        message: `[${requestId}] ${error.errorCode}: ${error.message}`,
        timestamp: Date.now(),
      };
    }

    return {
      status: 'error',
      message: `[${requestId}] Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: Date.now(),
    };
  }
}

function createTimeout(ms: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

export function validateRawInput(raw: string): {
  valid: boolean;
  error?: string;
} {
  if (typeof raw !== 'string') {
    return { valid: false, error: 'Input must be a string' };
  }
  if (raw.length === 0) {
    return { valid: false, error: 'Input cannot be empty' };
  }
  if (raw.length > 1_000_000) {
    return { valid: false, error: 'Input exceeds maximum size of 1MB' };
  }
  return { valid: true };
}
