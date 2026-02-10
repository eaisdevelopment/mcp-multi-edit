# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-10

### Added
- Benchmark suite with 3 realistic scenarios across synthetic and real-world targets
- Per-file evidence tables, visual ASCII charts, and execution timing in benchmark report
- `npm run benchmark` script for reproducible value measurement

### Changed
- Server display name now shows "Multi Edit MCP Server from Essential AI Solutions (essentialai.uk)"

### Removed
- Internal SDLC files (.planning/, specification/, CLAUDE.md) from repository

## [0.1.0] - 2026-02-09

### Added
- `multi_edit` tool: atomic find-and-replace operations on a single file
- `multi_edit_files` tool: coordinated edits across multiple files with rollback
- Dry-run mode for previewing changes without modification
- Automatic backup (.bak) file creation before edits
- Structured error responses with recovery hints for LLM retry
- Conflict detection for overlapping edits
- Path validation (absolute paths, symlink resolution, existence checks)
- Replace-all flag for global string replacement per edit
- 90%+ test coverage with unit and integration tests

[0.2.0]: https://github.com/eaisdevelopment/mcp-multi-edit/releases/tag/v0.2.0
[0.1.0]: https://github.com/eaisdevelopment/mcp-multi-edit/releases/tag/v0.1.0
