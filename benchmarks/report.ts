/**
 * Report generation module for benchmark results.
 *
 * Pure function (no I/O): takes measurement data and run metadata,
 * returns a complete Markdown report string. Caller handles file writing.
 */

import type {
  MeasurementResult,
  BenchmarkRunResult,
} from './types.js';

/**
 * Pad a string to a minimum width (right-padded).
 */
function pad(value: string, width: number): string {
  return value.padEnd(width);
}

/**
 * Pad a number string to a minimum width (left-padded for right-alignment).
 */
function padNum(value: string | number, width: number): string {
  return String(value).padStart(width);
}

/**
 * Render an ASCII bar chart line.
 */
function renderBar(label: string, value: number, maxValue: number, width: number = 40): string {
  const filled = maxValue === 0 ? 0 : Math.round((value / maxValue) * width);
  const bar = '\u2588'.repeat(filled);
  return `  ${label.padEnd(24)} ${bar} ${value.toLocaleString()}`;
}

/**
 * Format a duration in milliseconds to a human-readable string.
 */
function formatDuration(startIso: string, endIso: string): string {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const diffMs = endMs - startMs;

  if (diffMs < 1000) return `${diffMs}ms`;
  if (diffMs < 60_000) return `${(diffMs / 1000).toFixed(1)}s`;
  const minutes = Math.floor(diffMs / 60_000);
  const seconds = Math.round((diffMs % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Generate a complete Markdown benchmark report from measurement and run data.
 *
 * The report includes four sections:
 * 1. Executive Summary -- headline metrics for decision-makers
 * 2. Tool Call Comparison -- side-by-side tables
 * 3. Technical Deep Dive -- per-scenario breakdown for developers
 * 4. Methodology -- how the benchmarks work
 *
 * @param measurement - Aggregated measurement data from computeMeasurements
 * @param runResult - Raw benchmark run result with timing and config
 * @returns Complete Markdown report as a string
 */
export function generateReport(
  measurement: MeasurementResult,
  runResult: BenchmarkRunResult,
): string {
  const sections: string[] = [];

  // Title and metadata
  sections.push(renderTitle(measurement, runResult));

  if (measurement.scenarios.length === 0) {
    sections.push('> No scenarios were measured. Run benchmarks first.\n');
    return sections.join('\n');
  }

  // Section 1: Executive Summary
  sections.push(renderExecutiveSummary(measurement));

  // Section 2: Comparison Tables
  sections.push(renderComparisonTables(measurement));

  // Section 3: Technical Deep Dive (with per-file evidence)
  sections.push(renderTechnicalDeepDive(measurement));

  // Section 4: Execution Timing
  sections.push(renderTimingComparison(measurement));

  // Section 5: Methodology
  sections.push(renderMethodology());

  // Section 6: Reproduce
  sections.push(renderReproduction());

  return sections.join('\n');
}

/**
 * Render the report title and metadata block.
 */
function renderTitle(
  measurement: MeasurementResult,
  runResult: BenchmarkRunResult,
): string {
  const targetNames = [...new Set(measurement.scenarios.map((s) => s.target_name))];
  const duration = formatDuration(runResult.started_at, runResult.completed_at);

  return [
    '# MCP Multi-Edit Benchmark Report',
    '',
    `**Generated:** ${measurement.generated_at}`,
    `**Run duration:** ${duration}`,
    `**Scenarios measured:** ${measurement.summary.total_scenarios}`,
    `**Targets:** ${targetNames.join(', ')}`,
    '',
  ].join('\n');
}

/**
 * Render the Executive Summary section (REPT-01).
 */
function renderExecutiveSummary(measurement: MeasurementResult): string {
  const s = measurement.summary;
  const totalIndividualTokens = measurement.scenarios.reduce((sum, m) => sum + m.tokens.individual_tokens, 0);
  const totalMultiEditTokens = measurement.scenarios.reduce((sum, m) => sum + m.tokens.multi_edit_tokens, 0);

  return [
    '## Executive Summary',
    '',
    `- **Call reduction:** ${s.overall_call_reduction_pct}% fewer tool calls with \`multi_edit\` vs individual Edit`,
    `- **Token savings:** ${s.overall_token_savings_pct}% estimated context reduction with \`multi_edit\``,
    `- **Scenarios measured:** ${s.total_scenarios} scenario-target combinations`,
    `- **Total calls:** ${s.total_individual_calls} individual calls reduced to ${s.total_multi_edit_calls} with \`multi_edit\` (and ${s.total_multi_edit_files_calls} with \`multi_edit_files\`)`,
    '',
    'Using `multi_edit` reduces tool call overhead by batching multiple edits per file into a single tool call.',
    'The `multi_edit_files` tool further consolidates cross-file operations into a single call,',
    'eliminating per-file overhead entirely when coordinated edits span multiple files.',
    '',
    '### Visual Summary',
    '',
    '```',
    'Tool Calls:',
    renderBar('Without multi_edit', s.total_individual_calls, s.total_individual_calls),
    renderBar('With multi_edit', s.total_multi_edit_calls, s.total_individual_calls)
      + `  (-${s.overall_call_reduction_pct}%)`,
    renderBar('With multi_edit_files', s.total_multi_edit_files_calls, s.total_individual_calls)
      + `  (-${Math.round(((s.total_individual_calls - s.total_multi_edit_files_calls) / s.total_individual_calls) * 100)}%)`,
    '',
    'Token Usage:',
    renderBar('Without multi_edit', totalIndividualTokens, totalIndividualTokens),
    renderBar('With multi_edit', totalMultiEditTokens, totalIndividualTokens)
      + `  (-${s.overall_token_savings_pct}%)`,
    '```',
    '',
  ].join('\n');
}

/**
 * Render the Comparison Tables section (REPT-03).
 */
function renderComparisonTables(measurement: MeasurementResult): string {
  const lines: string[] = [];
  const scenarios = measurement.scenarios;
  const s = measurement.summary;

  // Table 1: Tool Call Comparison
  lines.push('## Tool Call Comparison');
  lines.push('');
  lines.push('| Scenario | Target | Individual Edit | multi_edit | multi_edit_files | Call Reduction % |');
  lines.push('|----------|--------|----------------:|----------:|-----------------:|-----------------:|');

  for (const m of scenarios) {
    lines.push(
      `| ${pad(m.scenario_name, 1)} | ${pad(m.target_name, 1)} | ${padNum(m.calls.individual_edit_calls, 1)} | ${padNum(m.calls.multi_edit_calls, 1)} | ${padNum(m.calls.multi_edit_files_calls, 1)} | ${padNum(m.calls.reduction_vs_individual + '%', 1)} |`,
    );
  }

  // Totals row
  lines.push(
    `| **Total** | | **${s.total_individual_calls}** | **${s.total_multi_edit_calls}** | **${s.total_multi_edit_files_calls}** | **${s.overall_call_reduction_pct}%** |`,
  );
  lines.push('');

  // Table 2: Token/Context Usage
  lines.push('### Token/Context Usage');
  lines.push('');
  lines.push('| Scenario | Target | Individual (tokens) | multi_edit (tokens) | multi_edit_files (tokens) | Savings % |');
  lines.push('|----------|--------|--------------------:|--------------------:|--------------------------:|----------:|');

  for (const m of scenarios) {
    lines.push(
      `| ${pad(m.scenario_name, 1)} | ${pad(m.target_name, 1)} | ${padNum(m.tokens.individual_tokens, 1)} | ${padNum(m.tokens.multi_edit_tokens, 1)} | ${padNum(m.tokens.multi_edit_files_tokens, 1)} | ${padNum(m.tokens.savings_vs_individual_pct + '%', 1)} |`,
    );
  }

  // Totals row for tokens
  const totalIndividualTokens = scenarios.reduce((sum, m) => sum + m.tokens.individual_tokens, 0);
  const totalMultiEditTokens = scenarios.reduce((sum, m) => sum + m.tokens.multi_edit_tokens, 0);
  const totalMultiFilesTokens = scenarios.reduce((sum, m) => sum + m.tokens.multi_edit_files_tokens, 0);

  lines.push(
    `| **Total** | | **${totalIndividualTokens}** | **${totalMultiEditTokens}** | **${totalMultiFilesTokens}** | **${s.overall_token_savings_pct}%** |`,
  );
  lines.push('');

  return lines.join('\n');
}

/**
 * Render the Technical Deep Dive section (REPT-02).
 */
function renderTechnicalDeepDive(measurement: MeasurementResult): string {
  const lines: string[] = [];

  lines.push('## Technical Deep Dive');
  lines.push('');

  for (const m of measurement.scenarios) {
    lines.push(`### ${m.scenario_name} (${m.target_name})`);
    lines.push('');

    // Scenario description
    if (m.description) {
      lines.push(`*${m.description}*`);
      lines.push('');
    }

    // Timing with individual comparison
    const individualDur = m.individual_duration_ms;
    const speedup = individualDur && m.duration_ms > 0
      ? (individualDur / m.duration_ms).toFixed(1)
      : undefined;
    const timingStr = speedup && individualDur
      ? `${m.duration_ms.toFixed(1)}ms batched, ${individualDur.toFixed(1)}ms individual (${speedup}x speedup)`
      : `${m.duration_ms.toFixed(1)}ms (batched)`;

    lines.push(`- **Files edited:** ${m.files_edited}`);
    lines.push(`- **Total edits:** ${m.total_edits}`);
    lines.push(`- **Duration:** ${timingStr}`);
    lines.push('');

    // Visual bar chart for this scenario
    lines.push('```');
    lines.push(renderBar('Without multi_edit', m.calls.individual_edit_calls, m.calls.individual_edit_calls) + ' calls');
    lines.push(renderBar('With multi_edit', m.calls.multi_edit_calls, m.calls.individual_edit_calls)
      + ` calls  (-${m.calls.reduction_vs_individual}%)`);
    lines.push('```');
    lines.push('');

    lines.push('**Call breakdown:**');
    lines.push('');
    lines.push(`| Approach | Calls |`);
    lines.push(`|----------|------:|`);
    lines.push(`| Individual Edit | ${m.calls.individual_edit_calls} |`);
    lines.push(`| multi_edit | ${m.calls.multi_edit_calls} |`);
    lines.push(`| multi_edit_files | ${m.calls.multi_edit_files_calls} |`);
    lines.push(`| **Reduction** | **${m.calls.reduction_vs_individual}%** (multi_edit vs individual) |`);
    lines.push('');

    lines.push('**Token breakdown:**');
    lines.push('');
    lines.push(`| Approach | Tokens |`);
    lines.push(`|----------|-------:|`);
    lines.push(`| Individual Edit | ${m.tokens.individual_tokens} |`);
    lines.push(`| multi_edit | ${m.tokens.multi_edit_tokens} |`);
    lines.push(`| multi_edit_files | ${m.tokens.multi_edit_files_tokens} |`);
    lines.push(`| **Savings** | **${m.tokens.savings_vs_individual_pct}%** (multi_edit vs individual) |`);
    lines.push('');

    // Per-file evidence table
    if (m.file_measurements.length > 0) {
      lines.push('**Per-file evidence:**');
      lines.push('');
      lines.push('| File | Edits | Without multi_edit | With multi_edit | Call Reduction |');
      lines.push('|------|------:|-------------------:|----------------:|---------------:|');

      for (const f of m.file_measurements) {
        lines.push(
          `| ${f.file_path} | ${f.edit_count} | ${f.individual_calls} calls, ${f.individual_tokens} tok | ${f.multi_edit_calls} call, ${f.multi_edit_tokens} tok | ${f.call_reduction_pct}% |`,
        );
      }

      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Render the Execution Timing comparison section.
 */
function renderTimingComparison(measurement: MeasurementResult): string {
  const lines: string[] = [];

  lines.push('## Execution Timing');
  lines.push('');
  lines.push('| Scenario | Target | Batched (ms) | Individual (ms) | I/O Speedup |');
  lines.push('|----------|--------|-------------:|----------------:|------------:|');

  for (const m of measurement.scenarios) {
    const individualMs = m.individual_duration_ms;
    const speedup = individualMs && m.duration_ms > 0
      ? `${(individualMs / m.duration_ms).toFixed(1)}x`
      : 'N/A';

    lines.push(
      `| ${m.scenario_name} | ${m.target_name} | ${m.duration_ms.toFixed(1)} | ${individualMs !== undefined ? individualMs.toFixed(1) : 'N/A'} | ${speedup} |`,
    );
  }

  lines.push('');
  lines.push('> Timings measure local file I/O overhead only. In production MCP usage,');
  lines.push('> each tool call also incurs LLM inference latency (~1-3s per call), making');
  lines.push('> the real-world savings much larger. For example, 18 individual Edit calls');
  lines.push('> at ~2s each = ~36s, vs 4 multi_edit calls at ~2s each = ~8s.');
  lines.push('');

  return lines.join('\n');
}

/**
 * Render the Reproduce These Results section.
 */
function renderReproduction(): string {
  return [
    '## Reproduce These Results',
    '',
    '```bash',
    'npm run benchmark',
    '```',
    '',
    'Results are written to `benchmarks/results/BENCHMARK-REPORT.md`.',
    'Source code for all scenarios is in `benchmarks/scenarios/`.',
    'Test targets are in `benchmarks/targets/`.',
    '',
  ].join('\n');
}

/**
 * Render the Methodology section.
 */
function renderMethodology(): string {
  return [
    '## Methodology',
    '',
    'Benchmarks run real edit operations using the project\'s own editor engine (`applyEditsToContent`).',
    'Three approaches are simulated from the same edit set:',
    '',
    '1. **Individual Edit** -- one tool call per edit operation (read file, apply single edit, write file)',
    '2. **multi_edit** -- one tool call per file (all edits for a file batched together)',
    '3. **multi_edit_files** -- one tool call for all files (entire edit set in a single call)',
    '',
    '### Token Estimation Model',
    '',
    'Token costs use simplified constants representing MCP message overhead:',
    '',
    '| Component | Tokens |',
    '|-----------|-------:|',
    '| Individual Edit call overhead | 150 |',
    '| multi_edit base (per file) | 100 |',
    '| multi_edit per edit | 50 |',
    '| multi_edit_files base | 100 |',
    '| multi_edit_files per file | 80 |',
    '| multi_edit_files per edit | 50 |',
    '',
    'These are comparative estimates, not exact token counts. The relative differences',
    'between approaches are more meaningful than absolute numbers.',
    '',
    '### Timing',
    '',
    'Duration measurements reflect local file I/O only, not network overhead of actual MCP',
    'transport. Both batched and individual timings use the same editor engine; the difference',
    'captures the overhead of repeated file reads and writes in the individual approach.',
    '',
  ].join('\n');
}
