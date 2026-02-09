/**
 * Benchmark harness engine.
 *
 * Core execution engine that:
 * - Loads synthetic and real-world targets
 * - Creates isolated working copies for each scenario run
 * - Applies scenario edits using the project's own applyEditsToContent
 * - Validates results via scenario-provided validation functions
 * - Collects structured ScenarioResult data
 * - Writes results as JSON to benchmarks/results/
 */

import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import type {
  BenchmarkScenario,
  BenchmarkTarget,
  ScenarioResult,
  HarnessConfig,
  BenchmarkRunResult,
  FileEdits,
  FileEditDetail,
} from './types.js';
import {
  loadSyntheticTarget,
  loadRealWorldTarget,
  createWorkingCopy,
} from './targets/loader.js';
import { applyEditsToContent, readFileValidated } from '../src/core/editor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the default harness configuration.
 */
export function getDefaultConfig(): HarnessConfig {
  return {
    tmp_dir: path.resolve(__dirname, 'tmp'),
    results_dir: path.resolve(__dirname, 'results'),
    preserve_tmp: true,
  };
}

/**
 * Run a single benchmark scenario against a single target.
 *
 * Process:
 * 1. Create a fresh working copy of the target
 * 2. Generate edits from the scenario
 * 3. Apply each file's edits using applyEditsToContent
 * 4. Write edited content back to working copy
 * 5. Validate results via scenario's validateResults
 * 6. Return structured ScenarioResult with metrics
 */
export async function runScenario(
  scenario: BenchmarkScenario,
  target: BenchmarkTarget,
  config: HarnessConfig,
): Promise<ScenarioResult> {
  // Generate unique run ID
  const runId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  // Create fresh working copy
  const { workDir, fileMap } = await createWorkingCopy(target, config.tmp_dir, runId);

  // Generate edits from scenario
  const fileEditsList: FileEdits[] = scenario.generateEdits(target);

  // Track timing
  const startTime = performance.now();

  let filesEdited = 0;
  let totalEdits = 0;

  // Apply edits file by file
  for (const fileEdits of fileEditsList) {
    const absPath = fileMap.get(fileEdits.file_path);
    if (!absPath) {
      // File not in working copy -- try resolving from workDir
      const resolvedPath = path.join(workDir, fileEdits.file_path);
      try {
        await fsPromises.access(resolvedPath);
      } catch {
        return {
          scenario_name: scenario.name,
          target_name: target.name,
          success: false,
          files_edited: filesEdited,
          total_edits: totalEdits,
          multi_edit_calls: filesEdited,
          equivalent_individual_calls: totalEdits,
          duration_ms: performance.now() - startTime,
          validation: { valid: false, errors: [`File not found in working copy: ${fileEdits.file_path}`] },
          error: `File not found in working copy: ${fileEdits.file_path}`,
        };
      }
    }

    const filePath = absPath || path.join(workDir, fileEdits.file_path);

    // Read file content
    const content = await readFileValidated(filePath);

    // Apply edits using the project's own editor
    const result = applyEditsToContent(filePath, content, fileEdits.edits);

    if (!result.success) {
      return {
        scenario_name: scenario.name,
        target_name: target.name,
        success: false,
        files_edited: filesEdited,
        total_edits: totalEdits,
        multi_edit_calls: filesEdited,
        equivalent_individual_calls: totalEdits,
        duration_ms: performance.now() - startTime,
        validation: { valid: false, errors: [result.error || 'Edit failed'] },
        error: result.error || `Edit failed on ${fileEdits.file_path}`,
      };
    }

    // Write edited content back to working copy (plain writeFile, not atomic)
    await fsPromises.writeFile(filePath, result.final_content!, 'utf-8');

    filesEdited++;
    totalEdits += fileEdits.edits.length;
  }

  const endTime = performance.now();
  const durationMs = endTime - startTime;

  // Build per-file evidence details
  const file_details: FileEditDetail[] = fileEditsList.map((fe) => ({
    file_path: fe.file_path,
    edit_count: fe.edits.length,
    line_count: target.files.find((f) => f.file_path === fe.file_path)?.line_count ?? 0,
  }));

  // Validate results
  const validation = await scenario.validateResults(target, workDir);

  return {
    scenario_name: scenario.name,
    target_name: target.name,
    success: validation.valid,
    files_edited: filesEdited,
    total_edits: totalEdits,
    multi_edit_calls: filesEdited, // One multi_edit call per file
    equivalent_individual_calls: totalEdits, // One Edit call per edit operation
    duration_ms: durationMs,
    validation,
    error: validation.valid ? undefined : `Validation failed: ${validation.errors.join('; ')}`,
    file_details,
    description: scenario.description,
  };
}

/**
 * Run a single benchmark scenario in individual-edit simulation mode.
 *
 * Simulates the individual Edit tool approach: for each edit, read the file,
 * apply only that single edit, write back. This measures the overhead of N
 * separate read-edit-write cycles vs the batched multi_edit approach.
 */
export async function runScenarioIndividual(
  scenario: BenchmarkScenario,
  target: BenchmarkTarget,
  config: HarnessConfig,
): Promise<{ duration_ms: number; success: boolean }> {
  // Create a fresh working copy
  const runId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-individual`;
  const { workDir, fileMap } = await createWorkingCopy(target, config.tmp_dir, runId);

  // Generate edits from scenario
  const fileEditsList: FileEdits[] = scenario.generateEdits(target);

  // Start timing
  const startTime = performance.now();

  // Apply edits one at a time (individual Edit tool simulation)
  for (const fileEdits of fileEditsList) {
    const absPath = fileMap.get(fileEdits.file_path);
    const filePath = absPath || path.join(workDir, fileEdits.file_path);

    for (const singleEdit of fileEdits.edits) {
      // Read file (simulates individual Edit tool reading the file each time)
      const content = await readFileValidated(filePath);

      // Apply only this single edit
      const result = applyEditsToContent(filePath, content, [singleEdit]);

      if (!result.success) {
        return { duration_ms: performance.now() - startTime, success: false };
      }

      // Write result back (simulates individual Edit tool writing the file)
      await fsPromises.writeFile(filePath, result.final_content!, 'utf-8');
    }
  }

  const endTime = performance.now();
  const duration_ms = endTime - startTime;

  // Validate results
  const validation = await scenario.validateResults(target, workDir);

  return { duration_ms, success: validation.valid };
}

/**
 * Run the full benchmark suite: all scenarios against all targets.
 *
 * - Loads both synthetic and real-world targets
 * - Runs each scenario against each target sequentially (deterministic timing)
 * - Writes results JSON to results_dir
 * - Returns the full BenchmarkRunResult
 */
export async function runBenchmarkSuite(
  scenarios: BenchmarkScenario[],
  config?: Partial<HarnessConfig>,
): Promise<BenchmarkRunResult> {
  const defaults = getDefaultConfig();
  const mergedConfig: HarnessConfig = {
    tmp_dir: config?.tmp_dir ?? defaults.tmp_dir,
    results_dir: config?.results_dir ?? defaults.results_dir,
    preserve_tmp: config?.preserve_tmp ?? defaults.preserve_tmp,
  };

  // Ensure directories exist
  await fsPromises.mkdir(mergedConfig.tmp_dir, { recursive: true });
  await fsPromises.mkdir(mergedConfig.results_dir, { recursive: true });

  // Load targets
  const syntheticTarget = loadSyntheticTarget();
  const realWorldTarget = loadRealWorldTarget();
  const targets = [syntheticTarget, realWorldTarget];

  const startedAt = new Date().toISOString();
  const results: ScenarioResult[] = [];

  // Run each scenario against each target sequentially
  for (const scenario of scenarios) {
    for (const target of targets) {
      const result = await runScenario(scenario, target, mergedConfig);

      // Also run individual-edit simulation for timing comparison
      const individualResult = await runScenarioIndividual(scenario, target, mergedConfig);
      result.individual_duration_ms = individualResult.duration_ms;

      results.push(result);
    }
  }

  const completedAt = new Date().toISOString();

  const runResult: BenchmarkRunResult = {
    started_at: startedAt,
    completed_at: completedAt,
    config: mergedConfig,
    results,
  };

  // Write results to JSON file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsPath = path.join(mergedConfig.results_dir, `benchmark-${timestamp}.json`);
  await fsPromises.writeFile(resultsPath, JSON.stringify(runResult, null, 2), 'utf-8');

  return runResult;
}
