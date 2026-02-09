# MCP Multi-Edit Benchmark Report

**Generated:** 2026-02-09T23:48:03.304Z
**Run duration:** 55ms
**Scenarios measured:** 6
**Targets:** synthetic-sdk, mcp-multi-edit

## Executive Summary

- **Call reduction:** 80% fewer tool calls with `multi_edit` vs individual Edit
- **Token savings:** 50% estimated context reduction with `multi_edit`
- **Scenarios measured:** 6 scenario-target combinations
- **Total calls:** 105 individual calls reduced to 21 with `multi_edit` (and 6 with `multi_edit_files`)

Using `multi_edit` reduces tool call overhead by batching multiple edits per file into a single tool call.
The `multi_edit_files` tool further consolidates cross-file operations into a single call,
eliminating per-file overhead entirely when coordinated edits span multiple files.

### Visual Summary

```
Tool Calls:
  Without multi_edit       ████████████████████████████████████████ 105
  With multi_edit          ████████ 21  (-80%)
  With multi_edit_files    ██ 6  (-94%)

Token Usage:
  Without multi_edit       ████████████████████████████████████████ 15,750
  With multi_edit          ████████████████████ 7,850  (-50%)
```

## Tool Call Comparison

| Scenario | Target | Individual Edit | multi_edit | multi_edit_files | Call Reduction % |
|----------|--------|----------------:|----------:|-----------------:|-----------------:|
| error-handling-enhancement | synthetic-sdk | 18 | 4 | 1 | 78% |
| error-handling-enhancement | mcp-multi-edit | 15 | 3 | 1 | 80% |
| logging-observability | synthetic-sdk | 21 | 4 | 1 | 81% |
| logging-observability | mcp-multi-edit | 17 | 3 | 1 | 82% |
| pattern-standardization | synthetic-sdk | 18 | 4 | 1 | 78% |
| pattern-standardization | mcp-multi-edit | 16 | 3 | 1 | 81% |
| **Total** | | **105** | **21** | **6** | **80%** |

### Token/Context Usage

| Scenario | Target | Individual (tokens) | multi_edit (tokens) | multi_edit_files (tokens) | Savings % |
|----------|--------|--------------------:|--------------------:|--------------------------:|----------:|
| error-handling-enhancement | synthetic-sdk | 2700 | 1400 | 1320 | 48% |
| error-handling-enhancement | mcp-multi-edit | 2250 | 1050 | 1090 | 53% |
| logging-observability | synthetic-sdk | 3150 | 1600 | 1470 | 49% |
| logging-observability | mcp-multi-edit | 2550 | 1200 | 1190 | 53% |
| pattern-standardization | synthetic-sdk | 2700 | 1400 | 1320 | 48% |
| pattern-standardization | mcp-multi-edit | 2400 | 1200 | 1140 | 50% |
| **Total** | | **15750** | **7850** | **7530** | **50%** |

## Technical Deep Dive

### error-handling-enhancement (synthetic-sdk)

*Enhance error handling across multiple files. Synthetic: add error code prefixes and severity tags (4 files, 20 edits). Real-world: expand recovery hints, error classification, and tool descriptions (3 files, 15 edits).*

- **Files edited:** 4
- **Total edits:** 18
- **Duration:** 1.3ms batched, 2.8ms individual (2.2x speedup)

```
  Without multi_edit       ████████████████████████████████████████ 18 calls
  With multi_edit          █████████ 4 calls  (-78%)
```

**Call breakdown:**

| Approach | Calls |
|----------|------:|
| Individual Edit | 18 |
| multi_edit | 4 |
| multi_edit_files | 1 |
| **Reduction** | **78%** (multi_edit vs individual) |

**Token breakdown:**

| Approach | Tokens |
|----------|-------:|
| Individual Edit | 2700 |
| multi_edit | 1400 |
| multi_edit_files | 1320 |
| **Savings** | **48%** (multi_edit vs individual) |

**Per-file evidence:**

| File | Edits | Without multi_edit | With multi_edit | Call Reduction |
|------|------:|-------------------:|----------------:|---------------:|
| src/plugins/csv-plugin.ts | 4 | 4 calls, 600 tok | 1 call, 300 tok | 75% |
| src/plugins/json-plugin.ts | 4 | 4 calls, 600 tok | 1 call, 300 tok | 75% |
| src/handlers/error-handler.ts | 5 | 5 calls, 750 tok | 1 call, 350 tok | 80% |
| src/handlers/input-handler.ts | 5 | 5 calls, 750 tok | 1 call, 350 tok | 80% |

### error-handling-enhancement (mcp-multi-edit)

*Enhance error handling across multiple files. Synthetic: add error code prefixes and severity tags (4 files, 20 edits). Real-world: expand recovery hints, error classification, and tool descriptions (3 files, 15 edits).*

- **Files edited:** 3
- **Total edits:** 15
- **Duration:** 0.6ms batched, 2.4ms individual (4.0x speedup)

```
  Without multi_edit       ████████████████████████████████████████ 15 calls
  With multi_edit          ████████ 3 calls  (-80%)
```

**Call breakdown:**

| Approach | Calls |
|----------|------:|
| Individual Edit | 15 |
| multi_edit | 3 |
| multi_edit_files | 1 |
| **Reduction** | **80%** (multi_edit vs individual) |

**Token breakdown:**

| Approach | Tokens |
|----------|-------:|
| Individual Edit | 2250 |
| multi_edit | 1050 |
| multi_edit_files | 1090 |
| **Savings** | **53%** (multi_edit vs individual) |

**Per-file evidence:**

| File | Edits | Without multi_edit | With multi_edit | Call Reduction |
|------|------:|-------------------:|----------------:|---------------:|
| src/core/errors.ts | 5 | 5 calls, 750 tok | 1 call, 350 tok | 80% |
| src/core/reporter.ts | 5 | 5 calls, 750 tok | 1 call, 350 tok | 80% |
| src/server.ts | 5 | 5 calls, 750 tok | 1 call, 350 tok | 80% |

### logging-observability (synthetic-sdk)

*Add logging context, rule annotations, improved validation messages, and prototype chain fixes. Synthetic: 4 files, 21 edits. Real-world: 3 files, 17 edits.*

- **Files edited:** 4
- **Total edits:** 21
- **Duration:** 0.5ms batched, 3.4ms individual (6.8x speedup)

```
  Without multi_edit       ████████████████████████████████████████ 21 calls
  With multi_edit          ████████ 4 calls  (-81%)
```

**Call breakdown:**

| Approach | Calls |
|----------|------:|
| Individual Edit | 21 |
| multi_edit | 4 |
| multi_edit_files | 1 |
| **Reduction** | **81%** (multi_edit vs individual) |

**Token breakdown:**

| Approach | Tokens |
|----------|-------:|
| Individual Edit | 3150 |
| multi_edit | 1600 |
| multi_edit_files | 1470 |
| **Savings** | **49%** (multi_edit vs individual) |

**Per-file evidence:**

| File | Edits | Without multi_edit | With multi_edit | Call Reduction |
|------|------:|-------------------:|----------------:|---------------:|
| src/core/processor.ts | 5 | 5 calls, 750 tok | 1 call, 350 tok | 80% |
| src/core/transformer.ts | 6 | 6 calls, 900 tok | 1 call, 400 tok | 83% |
| src/core/validator.ts | 5 | 5 calls, 750 tok | 1 call, 350 tok | 80% |
| src/utils/errors.ts | 5 | 5 calls, 750 tok | 1 call, 350 tok | 80% |

### logging-observability (mcp-multi-edit)

*Add logging context, rule annotations, improved validation messages, and prototype chain fixes. Synthetic: 4 files, 21 edits. Real-world: 3 files, 17 edits.*

- **Files edited:** 3
- **Total edits:** 17
- **Duration:** 0.7ms batched, 3.5ms individual (5.3x speedup)

```
  Without multi_edit       ████████████████████████████████████████ 17 calls
  With multi_edit          ███████ 3 calls  (-82%)
```

**Call breakdown:**

| Approach | Calls |
|----------|------:|
| Individual Edit | 17 |
| multi_edit | 3 |
| multi_edit_files | 1 |
| **Reduction** | **82%** (multi_edit vs individual) |

**Token breakdown:**

| Approach | Tokens |
|----------|-------:|
| Individual Edit | 2550 |
| multi_edit | 1200 |
| multi_edit_files | 1190 |
| **Savings** | **53%** (multi_edit vs individual) |

**Per-file evidence:**

| File | Edits | Without multi_edit | With multi_edit | Call Reduction |
|------|------:|-------------------:|----------------:|---------------:|
| src/core/editor.ts | 6 | 6 calls, 900 tok | 1 call, 400 tok | 83% |
| src/core/validator.ts | 6 | 6 calls, 900 tok | 1 call, 400 tok | 83% |
| src/tools/multi-edit.ts | 5 | 5 calls, 750 tok | 1 call, 350 tok | 80% |

### pattern-standardization (synthetic-sdk)

*Standardize code patterns across files. Synthetic: 18 edits across 4 files (config, logger, cache, rate-limiter). Real-world: 16 edits across 3 files (types, server, multi-edit tool).*

- **Files edited:** 4
- **Total edits:** 18
- **Duration:** 0.5ms batched, 2.0ms individual (4.4x speedup)

```
  Without multi_edit       ████████████████████████████████████████ 18 calls
  With multi_edit          █████████ 4 calls  (-78%)
```

**Call breakdown:**

| Approach | Calls |
|----------|------:|
| Individual Edit | 18 |
| multi_edit | 4 |
| multi_edit_files | 1 |
| **Reduction** | **78%** (multi_edit vs individual) |

**Token breakdown:**

| Approach | Tokens |
|----------|-------:|
| Individual Edit | 2700 |
| multi_edit | 1400 |
| multi_edit_files | 1320 |
| **Savings** | **48%** (multi_edit vs individual) |

**Per-file evidence:**

| File | Edits | Without multi_edit | With multi_edit | Call Reduction |
|------|------:|-------------------:|----------------:|---------------:|
| src/config.ts | 4 | 4 calls, 600 tok | 1 call, 300 tok | 75% |
| src/utils/logger.ts | 4 | 4 calls, 600 tok | 1 call, 300 tok | 75% |
| src/middleware/cache.ts | 5 | 5 calls, 750 tok | 1 call, 350 tok | 80% |
| src/middleware/rate-limiter.ts | 5 | 5 calls, 750 tok | 1 call, 350 tok | 80% |

### pattern-standardization (mcp-multi-edit)

*Standardize code patterns across files. Synthetic: 18 edits across 4 files (config, logger, cache, rate-limiter). Real-world: 16 edits across 3 files (types, server, multi-edit tool).*

- **Files edited:** 3
- **Total edits:** 16
- **Duration:** 0.5ms batched, 4.1ms individual (7.9x speedup)

```
  Without multi_edit       ████████████████████████████████████████ 16 calls
  With multi_edit          ████████ 3 calls  (-81%)
```

**Call breakdown:**

| Approach | Calls |
|----------|------:|
| Individual Edit | 16 |
| multi_edit | 3 |
| multi_edit_files | 1 |
| **Reduction** | **81%** (multi_edit vs individual) |

**Token breakdown:**

| Approach | Tokens |
|----------|-------:|
| Individual Edit | 2400 |
| multi_edit | 1200 |
| multi_edit_files | 1140 |
| **Savings** | **50%** (multi_edit vs individual) |

**Per-file evidence:**

| File | Edits | Without multi_edit | With multi_edit | Call Reduction |
|------|------:|-------------------:|----------------:|---------------:|
| src/types/index.ts | 6 | 6 calls, 900 tok | 1 call, 400 tok | 83% |
| src/server.ts | 5 | 5 calls, 750 tok | 1 call, 350 tok | 80% |
| src/tools/multi-edit.ts | 5 | 5 calls, 750 tok | 1 call, 350 tok | 80% |

## Execution Timing

| Scenario | Target | Batched (ms) | Individual (ms) | I/O Speedup |
|----------|--------|-------------:|----------------:|------------:|
| error-handling-enhancement | synthetic-sdk | 1.3 | 2.8 | 2.2x |
| error-handling-enhancement | mcp-multi-edit | 0.6 | 2.4 | 4.0x |
| logging-observability | synthetic-sdk | 0.5 | 3.4 | 6.8x |
| logging-observability | mcp-multi-edit | 0.7 | 3.5 | 5.3x |
| pattern-standardization | synthetic-sdk | 0.5 | 2.0 | 4.4x |
| pattern-standardization | mcp-multi-edit | 0.5 | 4.1 | 7.9x |

> Timings measure local file I/O overhead only. In production MCP usage,
> each tool call also incurs LLM inference latency (~1-3s per call), making
> the real-world savings much larger. For example, 18 individual Edit calls
> at ~2s each = ~36s, vs 4 multi_edit calls at ~2s each = ~8s.

## Methodology

Benchmarks run real edit operations using the project's own editor engine (`applyEditsToContent`).
Three approaches are simulated from the same edit set:

1. **Individual Edit** -- one tool call per edit operation (read file, apply single edit, write file)
2. **multi_edit** -- one tool call per file (all edits for a file batched together)
3. **multi_edit_files** -- one tool call for all files (entire edit set in a single call)

### Token Estimation Model

Token costs use simplified constants representing MCP message overhead:

| Component | Tokens |
|-----------|-------:|
| Individual Edit call overhead | 150 |
| multi_edit base (per file) | 100 |
| multi_edit per edit | 50 |
| multi_edit_files base | 100 |
| multi_edit_files per file | 80 |
| multi_edit_files per edit | 50 |

These are comparative estimates, not exact token counts. The relative differences
between approaches are more meaningful than absolute numbers.

### Timing

Duration measurements reflect local file I/O only, not network overhead of actual MCP
transport. Both batched and individual timings use the same editor engine; the difference
captures the overhead of repeated file reads and writes in the individual approach.

## Reproduce These Results

```bash
npm run benchmark
```

Results are written to `benchmarks/results/BENCHMARK-REPORT.md`.
Source code for all scenarios is in `benchmarks/scenarios/`.
Test targets are in `benchmarks/targets/`.
