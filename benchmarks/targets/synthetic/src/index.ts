// Types
export type {
  ProcessorConfig,
  TransformResult,
  PluginInterface,
  LogLevel,
  HandlerResult,
  Logger,
} from './types.js';

// Config
export {
  createConfig,
  DEFAULT_CONFIG,
  CONFIG_VERSION,
  MAX_BATCH_SIZE,
  DEFAULT_TIMEOUT,
} from './config.js';

// Core
export { parseInput, detectFormat, createEmptyResult } from './core/parser.js';
export { transformData, chainTransforms } from './core/transformer.js';
export { validateInput, validateConfig, validateResult } from './core/validator.js';
export { processInput, processBatch, getProcessorVersion } from './core/processor.js';

// Utils
export { createLogger, parseLogLevel } from './utils/logger.js';
export {
  formatOutput,
  sleep,
  generateId,
  truncateString,
  deepClone,
  mergeResults,
} from './utils/helpers.js';
export {
  ProcessingError,
  ValidationError,
  PluginError,
  isProcessingError,
  isValidationError,
  isPluginError,
} from './utils/errors.js';

// Handlers
export { handleInput, validateRawInput } from './handlers/input-handler.js';
export { handleOutput, reprocessAndFormat } from './handlers/output-handler.js';
export { handleError, createErrorResult, safeExecute } from './handlers/error-handler.js';

// Middleware
export { createAuthMiddleware, validateToken, createConfigWithAuth } from './middleware/auth.js';
export { createRateLimiter, calculateEffectiveRate, estimateThroughput } from './middleware/rate-limiter.js';
export { createCache, createCacheKey, withCache } from './middleware/cache.js';

// Plugins
export { JsonPlugin, createJsonPlugin } from './plugins/json-plugin.js';
export { CsvPlugin, createCsvPlugin } from './plugins/csv-plugin.js';
