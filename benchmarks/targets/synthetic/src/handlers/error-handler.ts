import type { HandlerResult } from '../types.js';
import {
  isProcessingError,
  isValidationError,
  isPluginError,
} from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('error');

export function handleError(error: Error): HandlerResult {
  logger.error(`Error caught: ${error.message}`);

  if (isProcessingError(error)) {
    return {
      status: 'error',
      message: `Processing failed [${error.errorCode}]: ${error.message}`,
      timestamp: Date.now(),
    };
  }

  if (isValidationError(error)) {
    const fieldInfo = Object.keys(error.fieldErrors).length > 0
      ? ` (fields: ${Object.keys(error.fieldErrors).join(', ')})`
      : '';
    return {
      status: 'error',
      message: `Validation failed [${error.errorCode}]: ${error.message}${fieldInfo}`,
      timestamp: Date.now(),
    };
  }

  if (isPluginError(error)) {
    return {
      status: 'error',
      message: `Plugin "${error.pluginName}" failed [${error.errorCode}]: ${error.message}`,
      timestamp: Date.now(),
    };
  }

  return {
    status: 'error',
    message: `Unexpected error: ${error.message}`,
    timestamp: Date.now(),
  };
}

export function createErrorResult(
  code: string,
  message: string,
): HandlerResult {
  return {
    status: 'error',
    message: `[${code}] ${message}`,
    timestamp: Date.now(),
  };
}

export function safeExecute<T>(
  fn: () => T,
  fallback: T,
): { result: T; error?: Error } {
  try {
    return { result: fn() };
  } catch (error) {
    logger.error(`Safe execution caught error: ${error instanceof Error ? error.message : String(error)}`);
    return {
      result: fallback,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
