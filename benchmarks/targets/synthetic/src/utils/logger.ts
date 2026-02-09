import type { LogLevel, Logger } from '../types.js';
import { CONFIG_VERSION } from '../config.js';

const LOG_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function createLogger(level: LogLevel): Logger {
  const minPriority = LOG_PRIORITY[level];

  function shouldLog(msgLevel: LogLevel): boolean {
    return LOG_PRIORITY[msgLevel] >= minPriority;
  }

  function formatMessage(msgLevel: LogLevel, message: string, args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
    return `[${timestamp}] [${msgLevel.toUpperCase()}] [v${CONFIG_VERSION}] ${message}${argsStr}`;
  }

  return {
    debug(message: string, ...args: unknown[]): void {
      if (shouldLog('debug')) {
        const formatted = formatMessage('debug', message, args);
        console.debug(formatted);
      }
    },

    info(message: string, ...args: unknown[]): void {
      if (shouldLog('info')) {
        const formatted = formatMessage('info', message, args);
        console.info(formatted);
      }
    },

    warn(message: string, ...args: unknown[]): void {
      if (shouldLog('warn')) {
        const formatted = formatMessage('warn', message, args);
        console.warn(formatted);
      }
    },

    error(message: string, ...args: unknown[]): void {
      if (shouldLog('error')) {
        const formatted = formatMessage('error', message, args);
        console.error(formatted);
      }
    },
  };
}

export function parseLogLevel(value: string): LogLevel {
  const normalized = value.toLowerCase();
  if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error') {
    return normalized;
  }
  return 'info';
}
