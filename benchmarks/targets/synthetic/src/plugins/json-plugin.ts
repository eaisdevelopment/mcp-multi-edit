import type {
  PluginInterface,
  ProcessorConfig,
  TransformResult,
} from '../types.js';
import { DEFAULT_CONFIG } from '../config.js';
import { PluginError } from '../utils/errors.js';

export class JsonPlugin implements PluginInterface {
  readonly name = 'json-plugin';
  readonly version = '1.0.0';

  private config: ProcessorConfig = DEFAULT_CONFIG;
  private initialized = false;

  async initialize(config: ProcessorConfig): Promise<void> {
    this.config = config;
    this.initialized = true;
  }

  async process(input: unknown): Promise<TransformResult<unknown>> {
    if (!this.initialized) {
      throw new PluginError(
        'Plugin not initialized. Call initialize() first.',
        this.name,
        'PLUGIN_NOT_INITIALIZED',
      );
    }

    try {
      const data = this.parseJsonInput(input);
      const transformed = this.applyTransformations(data);

      return {
        success: true,
        data: transformed,
        errors: [],
        metadata: {
          plugin: this.name,
          version: this.version,
          outputFormat: this.config.outputFormat,
          fieldCount: Object.keys(transformed).length,
        },
      };
    } catch (error) {
      if (error instanceof PluginError) throw error;

      return {
        success: false,
        data: null,
        errors: [
          `JSON processing failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
        metadata: { plugin: this.name, version: this.version },
      };
    }
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }

  private parseJsonInput(input: unknown): Record<string, unknown> {
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed;
        }
        return { value: parsed };
      } catch {
        throw new PluginError(
          'Invalid JSON string provided',
          this.name,
          'INVALID_INPUT',
        );
      }
    }

    if (typeof input === 'object' && input !== null) {
      return input as Record<string, unknown>;
    }

    return { value: input };
  }

  private applyTransformations(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && this.config.verbose) {
        result[key] = value.trim();
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}

export function createJsonPlugin(
  config?: ProcessorConfig,
): JsonPlugin {
  const plugin = new JsonPlugin();
  if (config) {
    void plugin.initialize(config);
  }
  return plugin;
}
