#!/usr/bin/env npx tsx
/**
 * CLI entry point for running benchmarks.
 *
 * Usage:
 *   npx tsx benchmarks/run.ts   # Run all scenarios against all targets
 */

import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { runBenchmarkSuite } from './harness.js';
import {
  createErrorHandlingScenario,
  createLoggingScenario,
  createPatternStandardizationScenario,
} from './scenarios/index.js';
import { computeMeasurements } from './measurement.js';
import { generateReport } from './report.js';
import type { BenchmarkScenario, MeasurementResult } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  const scenarios: BenchmarkScenario[] = [
    createErrorHandlingScenario(),
    createLoggingScenario(),
    createPatternStandardizationScenario(),
  ];

  console.log(`Benchmark suite: ${scenarios.length} scenarios registered.`);

  const result = await runBenchmarkSuite(scenarios);

  // Print each result
  console.log('\n--- Results ---\n');
  for (const r of result.results) {
    const status = r.success ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${r.scenario_name} x ${r.target_name}`);
    console.log(`       files_edited: ${r.files_edited}, total_edits: ${r.total_edits}`);
    console.log(`       multi_edit_calls: ${r.multi_edit_calls}, equivalent_individual_calls: ${r.equivalent_individual_calls}`);
    console.log(`       duration: ${r.duration_ms.toFixed(1)}ms`);
    if (!r.success && r.error) {
      console.log(`       error: ${r.error}`);
    }
  }

  // Print summary
  const passed = result.results.filter((r) => r.success).length;
  const failed = result.results.filter((r) => !r.success).length;
  console.log(`\n--- Summary ---`);
  console.log(`Total: ${result.results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Results written to benchmarks/results/`);

  // Compute measurements from results
  const measurementResult: MeasurementResult = computeMeasurements(result.results);

  // Write measurement JSON to results directory
  const resultsDir = path.resolve(__dirname, 'results');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const measurementPath = path.join(resultsDir, `measurement-${timestamp}.json`);
  await fsPromises.writeFile(measurementPath, JSON.stringify(measurementResult, null, 2), 'utf-8');

  // Print measurement summary
  console.log('\n--- Measurements ---\n');

  console.log('Per-scenario:');
  for (const m of measurementResult.scenarios) {
    // Find the matching result to get individual_duration_ms
    const matchingResult = result.results.find(
      (r) => r.scenario_name === m.scenario_name && r.target_name === m.target_name
    );
    const individualDuration = matchingResult?.individual_duration_ms;

    console.log(`  ${m.scenario_name} x ${m.target_name}:`);
    console.log(`    Calls: ${m.calls.individual_edit_calls} individual -> ${m.calls.multi_edit_calls} multi_edit -> ${m.calls.multi_edit_files_calls} multi_edit_files`);
    console.log(`    Call reduction: ${m.calls.reduction_vs_individual}% (multi_edit vs individual)`);
    console.log(`    Token savings: ${m.tokens.savings_vs_individual_pct}% (multi_edit vs individual)`);
    console.log(`    Timing: ${m.duration_ms.toFixed(1)}ms batched, ${individualDuration !== undefined ? individualDuration.toFixed(1) : 'N/A'}ms individual`);
  }

  const s = measurementResult.summary;
  console.log('\nOverall:');
  console.log(`  Total call reduction: ${s.overall_call_reduction_pct}% (multi_edit vs individual Edit)`);
  console.log(`  Total token savings: ${s.overall_token_savings_pct}%`);
  console.log(`  Scenarios measured: ${s.total_scenarios}`);
  console.log(`\nMeasurement data written to: ${measurementPath}`);

  // Generate Markdown report
  const reportMarkdown = generateReport(measurementResult, result);
  const fixedReportPath = path.join(resultsDir, 'BENCHMARK-REPORT.md');
  const timestampedReportPath = path.join(resultsDir, `report-${timestamp}.md`);
  await fsPromises.writeFile(fixedReportPath, reportMarkdown, 'utf-8');
  await fsPromises.writeFile(timestampedReportPath, reportMarkdown, 'utf-8');
  console.log(`\nReport written to: ${fixedReportPath}`);
  console.log(`Timestamped copy: ${timestampedReportPath}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Benchmark run failed:', err);
  process.exit(1);
});
