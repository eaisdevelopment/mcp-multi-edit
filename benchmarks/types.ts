/**
 * Shared type definitions for the benchmark system.
 *
 * Consumed by:
 * - Harness (Plan 12-03)
 * - Scenarios (Phase 13)
 * - Measurement engine (Phase 14)
 *
 * Pure type definitions -- no runtime dependencies, no imports from project src/.
 */

/** Metadata about a single source file in a benchmark target */
export interface FileMetadata {
  /** Relative path from target root (e.g., "src/core/editor.ts") */
  file_path: string;
  /** Number of lines in the file */
  line_count: number;
  /** Number of exported functions/classes */
  export_count: number;
  /** Number of import statements */
  import_count: number;
  /** Edit types this file is suitable for */
  edit_types: Array<'rename' | 'feature-add' | 'config-migration'>;
}

/** A benchmark target -- a codebase to run scenarios against */
export interface BenchmarkTarget {
  /** Human-readable name */
  name: string;
  /** Target type */
  type: 'synthetic' | 'real-world';
  /** Root directory of the target (absolute path at runtime) */
  root_dir: string;
  /** Source directory relative to root */
  source_dir: string;
  /** Files in the target with metadata */
  files: FileMetadata[];
  /** Description of the target */
  description: string;
}

/** A single edit operation for benchmarks (mirrors multi_edit input) */
export interface BenchmarkEdit {
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

/** Edits for a single file */
export interface FileEdits {
  /** Relative path from target source dir */
  file_path: string;
  edits: BenchmarkEdit[];
}

/** A benchmark scenario -- a set of edits to apply to a target */
export interface BenchmarkScenario {
  /** Scenario name (e.g., "rename-processInput") */
  name: string;
  /** Scenario category */
  category: 'refactor' | 'feature-add' | 'config-migration';
  /** Human-readable description */
  description: string;
  /** Function to generate edits for a given target */
  generateEdits(target: BenchmarkTarget): FileEdits[];
  /** Function to validate results after edits are applied */
  validateResults(target: BenchmarkTarget, workDir: string): Promise<ValidationResult>;
}

/** Result of scenario validation */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Result of running a single scenario against a single target */
export interface ScenarioResult {
  scenario_name: string;
  target_name: string;
  /** Whether all edits were applied and validation passed */
  success: boolean;
  /** Number of files edited */
  files_edited: number;
  /** Total number of individual edit operations */
  total_edits: number;
  /** Number of multi_edit tool calls (1 per file for multi_edit, 1 total for multi_edit_files) */
  multi_edit_calls: number;
  /** Equivalent number of individual Edit tool calls (1 per edit operation) */
  equivalent_individual_calls: number;
  /** Execution time in milliseconds */
  duration_ms: number;
  /** Validation result */
  validation: ValidationResult;
  /** Error message if failed */
  error?: string;
  /** Duration of individual-edit simulation in milliseconds (separate read-edit-write per edit) */
  individual_duration_ms?: number;
  /** Per-file edit details for evidence reporting */
  file_details?: FileEditDetail[];
  /** Scenario description */
  description?: string;
}

/** Configuration for the benchmark harness */
export interface HarnessConfig {
  /** Directory to store temporary working copies */
  tmp_dir: string;
  /** Directory to write result JSON files */
  results_dir: string;
  /** Whether to preserve tmp directories after runs (default: true per user decision) */
  preserve_tmp: boolean;
}

/** Overall benchmark run result */
export interface BenchmarkRunResult {
  /** ISO timestamp of run start */
  started_at: string;
  /** ISO timestamp of run end */
  completed_at: string;
  /** Harness config used */
  config: HarnessConfig;
  /** Results for each scenario-target combination */
  results: ScenarioResult[];
}

/** Per-file edit detail captured during a benchmark run */
export interface FileEditDetail {
  file_path: string;
  edit_count: number;
  line_count: number;
}

/** Per-file measurement (calls + tokens for with/without comparison) */
export interface FileMeasurement {
  file_path: string;
  edit_count: number;
  individual_calls: number;
  multi_edit_calls: number;
  individual_tokens: number;
  multi_edit_tokens: number;
  call_reduction_pct: number;
  token_savings_pct: number;
}

/** Edit operation type (re-exported for convenience) */
export type EditOperation = BenchmarkEdit;

/** Measurement types for Phase 14 */

/** Comparison of tool call counts across the three usage approaches */
export interface CallComparison {
  /** Equivalent calls using single-edit tool (1 per edit operation) */
  individual_edit_calls: number;
  /** Calls using multi_edit tool (1 per file) */
  multi_edit_calls: number;
  /** Calls using multi_edit_files tool (1 per scenario, all files at once) */
  multi_edit_files_calls: number;
  /** Percentage reduction: multi_edit vs individual (e.g., 75 means 75% fewer calls) */
  reduction_vs_individual: number;
  /** Percentage reduction: multi_edit_files vs multi_edit */
  reduction_vs_multi_edit: number;
}

/** Estimated token usage across the three usage approaches */
export interface TokenEstimate {
  /** Estimated tokens for individual Edit approach */
  individual_tokens: number;
  /** Estimated tokens for multi_edit approach */
  multi_edit_tokens: number;
  /** Estimated tokens for multi_edit_files approach */
  multi_edit_files_tokens: number;
  /** Percentage token savings: multi_edit vs individual */
  savings_vs_individual_pct: number;
  /** Percentage: multi_edit_files vs individual */
  savings_multi_files_vs_individual_pct: number;
}

/** Measurement data for a single scenario run */
export interface ScenarioMeasurement {
  scenario_name: string;
  target_name: string;
  files_edited: number;
  total_edits: number;
  calls: CallComparison;
  tokens: TokenEstimate;
  /** Duration from the batched (multi_edit) run in milliseconds */
  duration_ms: number;
  /** Duration of individual-edit simulation in milliseconds */
  individual_duration_ms?: number;
  /** Per-file measurement breakdown */
  file_measurements: FileMeasurement[];
  /** Scenario description */
  description: string;
}

/** Aggregated measurement result across all scenarios */
export interface MeasurementResult {
  /** ISO timestamp of when measurements were generated */
  generated_at: string;
  scenarios: ScenarioMeasurement[];
  summary: MeasurementSummary;
}

/** Summary statistics across all measured scenarios */
export interface MeasurementSummary {
  total_scenarios: number;
  /** Sum of individual_edit_calls across all scenarios */
  total_individual_calls: number;
  /** Sum of multi_edit_calls across all scenarios */
  total_multi_edit_calls: number;
  /** Sum of multi_edit_files_calls across all scenarios */
  total_multi_edit_files_calls: number;
  /** Overall percentage: multi_edit vs individual */
  overall_call_reduction_pct: number;
  /** Overall percentage: multi_edit tokens vs individual tokens */
  overall_token_savings_pct: number;
}
