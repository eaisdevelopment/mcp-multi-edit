/**
 * Measurement computation functions for Phase 14.
 *
 * Pure functions (no I/O, no side effects) that transform raw ScenarioResult
 * data into rich measurement output for downstream reporting.
 */

import type {
  ScenarioResult,
  CallComparison,
  TokenEstimate,
  ScenarioMeasurement,
  MeasurementResult,
  MeasurementSummary,
  FileEditDetail,
  FileMeasurement,
} from './types.js';

// Token cost model constants (estimated overhead per MCP tool call)

/** Tokens per individual Edit call (tool envelope + params + response) */
const INDIVIDUAL_CALL_OVERHEAD = 150;

/** Tokens per multi_edit call (tool envelope + file_path) */
const MULTI_EDIT_BASE = 100;

/** Tokens per edit within a multi_edit call */
const MULTI_EDIT_PER_EDIT = 50;

/** Tokens for a single multi_edit_files call */
const MULTI_FILES_BASE = 100;

/** Tokens per file entry in multi_edit_files */
const MULTI_FILES_PER_FILE = 80;

/** Tokens per edit within multi_edit_files */
const MULTI_FILES_PER_EDIT = 50;

/**
 * Compute call count comparison across the three tool usage approaches.
 *
 * - Individual Edit: one call per edit operation
 * - multi_edit: one call per file
 * - multi_edit_files: one call for all files (or 0 if no files)
 *
 * @param files_edited - Number of distinct files edited
 * @param total_edits - Total number of individual edit operations
 * @returns CallComparison with counts and percentage reductions
 */
export function computeCallComparison(files_edited: number, total_edits: number): CallComparison {
  const individual_edit_calls = total_edits;
  const multi_edit_calls = files_edited;
  const multi_edit_files_calls = files_edited === 0 ? 0 : 1;

  const reduction_vs_individual =
    individual_edit_calls === 0
      ? 0
      : Math.round(((individual_edit_calls - multi_edit_calls) / individual_edit_calls) * 100);

  const reduction_vs_multi_edit =
    multi_edit_calls === 0
      ? 0
      : Math.round(((multi_edit_calls - multi_edit_files_calls) / multi_edit_calls) * 100);

  return {
    individual_edit_calls,
    multi_edit_calls,
    multi_edit_files_calls,
    reduction_vs_individual,
    reduction_vs_multi_edit,
  };
}

/**
 * Estimate token savings across the three tool usage approaches.
 *
 * Uses a simplified cost model based on MCP message overhead:
 * - Individual Edit: 150 tokens per call
 * - multi_edit: 100 base + 50 per edit, per file
 * - multi_edit_files: 100 base + 80 per file + 50 per edit
 *
 * @param files_edited - Number of distinct files edited
 * @param total_edits - Total number of individual edit operations
 * @returns TokenEstimate with token counts and percentage savings
 */
export function estimateTokenSavings(files_edited: number, total_edits: number): TokenEstimate {
  const individual_tokens = total_edits * INDIVIDUAL_CALL_OVERHEAD;

  let multi_edit_tokens: number;
  if (files_edited === 0) {
    multi_edit_tokens = 0;
  } else {
    const edits_per_file = Math.ceil(total_edits / files_edited);
    multi_edit_tokens = files_edited * (MULTI_EDIT_BASE + edits_per_file * MULTI_EDIT_PER_EDIT);
  }

  let multi_edit_files_tokens: number;
  if (files_edited === 0) {
    multi_edit_files_tokens = 0;
  } else {
    multi_edit_files_tokens =
      MULTI_FILES_BASE + files_edited * MULTI_FILES_PER_FILE + total_edits * MULTI_FILES_PER_EDIT;
  }

  const savings_vs_individual_pct =
    individual_tokens === 0
      ? 0
      : Math.round(((individual_tokens - multi_edit_tokens) / individual_tokens) * 100);

  const savings_multi_files_vs_individual_pct =
    individual_tokens === 0
      ? 0
      : Math.round(((individual_tokens - multi_edit_files_tokens) / individual_tokens) * 100);

  return {
    individual_tokens,
    multi_edit_tokens,
    multi_edit_files_tokens,
    savings_vs_individual_pct,
    savings_multi_files_vs_individual_pct,
  };
}

/**
 * Compute per-file measurements for evidence reporting.
 *
 * For each file in a scenario, calculates the individual vs multi_edit
 * call counts and token costs, providing concrete per-file evidence.
 */
export function computeFileMeasurements(file_details: FileEditDetail[]): FileMeasurement[] {
  return file_details.map((f) => {
    const individual_tokens = f.edit_count * INDIVIDUAL_CALL_OVERHEAD;
    const multi_edit_tokens = MULTI_EDIT_BASE + f.edit_count * MULTI_EDIT_PER_EDIT;
    return {
      file_path: f.file_path,
      edit_count: f.edit_count,
      individual_calls: f.edit_count,
      multi_edit_calls: 1,
      individual_tokens,
      multi_edit_tokens,
      call_reduction_pct: f.edit_count <= 1 ? 0 : Math.round(((f.edit_count - 1) / f.edit_count) * 100),
      token_savings_pct:
        individual_tokens === 0
          ? 0
          : Math.round(((individual_tokens - multi_edit_tokens) / individual_tokens) * 100),
    };
  });
}

/**
 * Compute full measurement result from raw scenario results.
 *
 * Filters to successful results only, computes per-scenario measurements,
 * and aggregates into a summary with overall statistics.
 *
 * @param results - Array of ScenarioResult from benchmark runs
 * @returns MeasurementResult with per-scenario measurements and summary
 */
export function computeMeasurements(results: ScenarioResult[]): MeasurementResult {
  const successfulResults = results.filter((r) => r.success);

  const scenarios: ScenarioMeasurement[] = successfulResults.map((r) => ({
    scenario_name: r.scenario_name,
    target_name: r.target_name,
    files_edited: r.files_edited,
    total_edits: r.total_edits,
    calls: computeCallComparison(r.files_edited, r.total_edits),
    tokens: estimateTokenSavings(r.files_edited, r.total_edits),
    duration_ms: r.duration_ms,
    individual_duration_ms: r.individual_duration_ms,
    file_measurements: computeFileMeasurements(r.file_details ?? []),
    description: r.description ?? '',
  }));

  // Aggregate summary
  const total_individual_calls = scenarios.reduce((sum, s) => sum + s.calls.individual_edit_calls, 0);
  const total_multi_edit_calls = scenarios.reduce((sum, s) => sum + s.calls.multi_edit_calls, 0);
  const total_multi_edit_files_calls = scenarios.reduce((sum, s) => sum + s.calls.multi_edit_files_calls, 0);

  const sum_individual_tokens = scenarios.reduce((sum, s) => sum + s.tokens.individual_tokens, 0);
  const sum_multi_edit_tokens = scenarios.reduce((sum, s) => sum + s.tokens.multi_edit_tokens, 0);

  const overall_call_reduction_pct =
    total_individual_calls === 0
      ? 0
      : Math.round(((total_individual_calls - total_multi_edit_calls) / total_individual_calls) * 100);

  const overall_token_savings_pct =
    sum_individual_tokens === 0
      ? 0
      : Math.round(((sum_individual_tokens - sum_multi_edit_tokens) / sum_individual_tokens) * 100);

  const summary: MeasurementSummary = {
    total_scenarios: scenarios.length,
    total_individual_calls,
    total_multi_edit_calls,
    total_multi_edit_files_calls,
    overall_call_reduction_pct,
    overall_token_savings_pct,
  };

  return {
    generated_at: new Date().toISOString(),
    scenarios,
    summary,
  };
}
