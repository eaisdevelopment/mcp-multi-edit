export interface ProcessorConfig {
  maxRetries: number;
  timeout: number;
  verbose: boolean;
  outputFormat: 'json' | 'csv' | 'xml';
}

export interface TransformResult<T> {
  success: boolean;
  data: T;
  errors: string[];
  metadata: Record<string, unknown>;
}

export interface PluginInterface {
  name: string;
  version: string;
  initialize(config: ProcessorConfig): Promise<void>;
  process(input: unknown): Promise<TransformResult<unknown>>;
  shutdown(): Promise<void>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface HandlerResult {
  status: 'ok' | 'error';
  message: string;
  timestamp: number;
}

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
