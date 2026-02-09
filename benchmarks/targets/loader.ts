/**
 * Target loader and working copy creation for the benchmark system.
 *
 * Responsible for:
 * - Loading synthetic and real-world target definitions
 * - Computing file metadata (line counts, export/import counts)
 * - Creating isolated working copies in temp directories for benchmark runs
 */

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { BenchmarkTarget, FileMetadata } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Compute metadata for a single file.
 *
 * Reads the file and counts lines, exports, and imports.
 * Does NOT assign edit_types -- the caller is responsible for that.
 */
export function computeFileMetadata(filePath: string): FileMetadata {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const line_count = lines.length;
  const export_count = lines.filter(line => /^export /.test(line)).length;
  const import_count = lines.filter(line => /^import /.test(line)).length;

  return {
    file_path: '', // Caller sets this to the relative path
    line_count,
    export_count,
    import_count,
    edit_types: [], // Caller assigns
  };
}

/**
 * Recursively scan a directory for all .ts files.
 *
 * Returns an array of absolute paths to .ts files.
 */
function scanTsFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Load the synthetic TypeScript SDK target.
 *
 * Scans the synthetic project's src/ directory for all .ts files,
 * computes metadata for each, and assigns edit_types heuristically.
 */
export function loadSyntheticTarget(): BenchmarkTarget {
  const syntheticRoot = path.resolve(__dirname, 'synthetic');
  const sourceDir = 'src';
  const srcPath = path.join(syntheticRoot, sourceDir);

  const tsFiles = scanTsFiles(srcPath);

  const files: FileMetadata[] = tsFiles.map(absPath => {
    const relativePath = path.relative(syntheticRoot, absPath);
    const metadata = computeFileMetadata(absPath);

    // Assign edit_types heuristically
    const editTypes: Array<'rename' | 'feature-add' | 'config-migration'> = ['rename', 'feature-add'];
    if (path.basename(absPath).includes('config')) {
      editTypes.push('config-migration');
    }

    return {
      ...metadata,
      file_path: relativePath,
      edit_types: editTypes,
    };
  });

  return {
    name: 'synthetic-sdk',
    type: 'synthetic',
    root_dir: syntheticRoot,
    source_dir: sourceDir,
    files,
    description: `Synthetic TypeScript SDK project with ${files.length} source files for controlled benchmark scenarios.`,
  };
}

/**
 * Load the real-world benchmark target (the mcp-multi-edit codebase itself).
 *
 * Reads the manifest JSON and resolves root_dir to the actual project root.
 * The project root is three levels up from benchmarks/targets/:
 *   benchmarks/targets/ -> benchmarks/ -> mcp-multi-edit/ -> multi-edit/ (project root with src/)
 */
export function loadRealWorldTarget(): BenchmarkTarget {
  const manifestPath = path.resolve(__dirname, 'real-world-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // Resolve root_dir: from benchmarks/targets/ up to the project root that contains src/
  const rootDir = path.resolve(__dirname, '..', '..');

  return {
    name: manifest.name,
    type: manifest.type,
    root_dir: rootDir,
    source_dir: manifest.source_dir,
    files: manifest.files,
    description: manifest.description,
  };
}

/**
 * Create an isolated working copy of a benchmark target.
 *
 * Copies all files listed in the target to a fresh temporary directory.
 * The directory structure mirrors the original (e.g., src/core/editor.ts).
 * Temp directories are NEVER auto-cleaned (preserved for debugging).
 *
 * @param target - The benchmark target to copy
 * @param tmpBaseDir - Base directory for temp copies
 * @param runId - Unique identifier for this run
 * @returns workDir (absolute path to copy root) and fileMap (relative path -> absolute path in copy)
 */
export async function createWorkingCopy(
  target: BenchmarkTarget,
  tmpBaseDir: string,
  runId: string,
): Promise<{ workDir: string; fileMap: Map<string, string> }> {
  const workDir = path.join(tmpBaseDir, runId, target.name);
  const fileMap = new Map<string, string>();

  for (const file of target.files) {
    const sourcePath = path.join(target.root_dir, file.file_path);
    const destPath = path.join(workDir, file.file_path);

    // Ensure destination directory exists
    await fsPromises.mkdir(path.dirname(destPath), { recursive: true });

    // Copy file
    await fsPromises.copyFile(sourcePath, destPath);

    fileMap.set(file.file_path, destPath);
  }

  return { workDir, fileMap };
}
