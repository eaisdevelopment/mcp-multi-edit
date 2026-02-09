import type {
  PluginInterface,
  ProcessorConfig,
  TransformResult,
} from '../types.js';
import { DEFAULT_CONFIG } from '../config.js';
import { PluginError } from '../utils/errors.js';

export class CsvPlugin implements PluginInterface {
  readonly name = 'csv-plugin';
  readonly version = '1.0.0';

  private config: ProcessorConfig = DEFAULT_CONFIG;
  private initialized = false;
  private delimiter = ',';

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
      const csvData = this.parseCsvInput(input);
      const transformed = this.transformRows(csvData);

      return {
        success: true,
        data: transformed,
        errors: [],
        metadata: {
          plugin: this.name,
          version: this.version,
          rowCount: transformed.rows.length,
          columnCount: transformed.headers.length,
          delimiter: this.delimiter,
        },
      };
    } catch (error) {
      if (error instanceof PluginError) throw error;

      return {
        success: false,
        data: null,
        errors: [
          `CSV processing failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
        metadata: { plugin: this.name, version: this.version },
      };
    }
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }

  private parseCsvInput(
    input: unknown,
  ): { headers: string[]; rows: string[][] } {
    let raw: string;

    if (typeof input === 'string') {
      raw = input;
    } else if (typeof input === 'object' && input !== null && 'toString' in input) {
      raw = String(input);
    } else {
      throw new PluginError(
        'CSV input must be a string',
        this.name,
        'INVALID_INPUT',
      );
    }

    const lines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = lines[0].split(this.delimiter).map((h) => h.trim());
    const rows = lines.slice(1).map((line) =>
      line.split(this.delimiter).map((cell) => cell.trim()),
    );

    return { headers, rows };
  }

  private transformRows(
    data: { headers: string[]; rows: string[][] },
  ): { headers: string[]; rows: Record<string, string>[] } {
    const objectRows = data.rows.map((row) => {
      const obj: Record<string, string> = {};
      data.headers.forEach((header, index) => {
        obj[header] = row[index] ?? '';
      });
      return obj;
    });

    return {
      headers: data.headers,
      rows: objectRows,
    };
  }
}

export function createCsvPlugin(
  config?: ProcessorConfig,
): CsvPlugin {
  const plugin = new CsvPlugin();
  if (config) {
    void plugin.initialize(config);
  }
  return plugin;
}
