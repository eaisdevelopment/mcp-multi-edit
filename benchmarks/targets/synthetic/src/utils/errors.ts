export class ProcessingError extends Error {
  readonly errorCode: string;

  constructor(message: string, errorCode: string = 'PROCESSING_ERROR') {
    super(message);
    this.name = 'ProcessingError';
    this.errorCode = errorCode;
  }

  toJSON(): Record<string, string> {
    return {
      name: this.name,
      message: this.message,
      errorCode: this.errorCode,
    };
  }
}

export class ValidationError extends Error {
  readonly errorCode: string;
  readonly fieldErrors: Record<string, string>;

  constructor(
    message: string,
    fieldErrors: Record<string, string> = {},
    errorCode: string = 'VALIDATION_ERROR',
  ) {
    super(message);
    this.name = 'ValidationError';
    this.errorCode = errorCode;
    this.fieldErrors = fieldErrors;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      errorCode: this.errorCode,
      fieldErrors: this.fieldErrors,
    };
  }
}

export class PluginError extends Error {
  readonly errorCode: string;
  readonly pluginName: string;

  constructor(
    message: string,
    pluginName: string,
    errorCode: string = 'PLUGIN_ERROR',
  ) {
    super(message);
    this.name = 'PluginError';
    this.errorCode = errorCode;
    this.pluginName = pluginName;
  }

  toJSON(): Record<string, string> {
    return {
      name: this.name,
      message: this.message,
      errorCode: this.errorCode,
      pluginName: this.pluginName,
    };
  }
}

export function isProcessingError(error: unknown): error is ProcessingError {
  return error instanceof ProcessingError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isPluginError(error: unknown): error is PluginError {
  return error instanceof PluginError;
}
