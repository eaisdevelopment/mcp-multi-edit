import type { ProcessorConfig } from './types.js';

export const CONFIG_VERSION = '1.0.0';

export const MAX_BATCH_SIZE = 100;

export const DEFAULT_TIMEOUT = 30000;

export const DEFAULT_CONFIG: ProcessorConfig = {
  maxRetries: 3,
  timeout: DEFAULT_TIMEOUT,
  verbose: false,
  outputFormat: 'json',
};

export function createConfig(
  overrides: Partial<ProcessorConfig>,
): ProcessorConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
  };
}
