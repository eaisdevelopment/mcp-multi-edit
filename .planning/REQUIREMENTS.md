# Requirements: MCP Multi-Edit Server

**Defined:** 2026-02-05
**Core Value:** Atomicity - all edits succeed or none apply

## v1 Requirements

### Core Editing

- [ ] **EDIT-01**: Tool accepts file path and array of edit operations
- [ ] **EDIT-02**: Each edit specifies old_string and new_string for exact match replacement
- [ ] **EDIT-03**: Edit fails with clear error if old_string not found in file
- [ ] **EDIT-04**: Edit fails with clear error if old_string matches multiple locations (non-unique)
- [ ] **EDIT-05**: Optional replace_all flag allows replacing all occurrences
- [ ] **EDIT-06**: Edits apply sequentially in array order
- [ ] **EDIT-07**: All edits in a call succeed or none apply (single-file atomicity)
- [ ] **EDIT-08**: Multi-file tool accepts array of file specifications
- [ ] **EDIT-09**: Multi-file edits are atomic across all files (all succeed or rollback)

### Safety & Validation

- [x] **SAFE-01**: Dry-run mode previews changes without writing to disk
- [ ] **SAFE-02**: File paths must be absolute (reject relative paths)
- [ ] **SAFE-03**: Detect overlapping edits that would conflict
- [ ] **SAFE-04**: Create backup file (.bak) before applying edits
- [ ] **SAFE-05**: Use atomic write pattern (temp file + rename)

### Error Handling

- [ ] **ERR-01**: Return isError: true for all failure cases
- [ ] **ERR-02**: Return structured JSON with consistent schema
- [ ] **ERR-03**: Include recovery_hint to help LLM retry
- [ ] **ERR-04**: Include match context (surrounding text) in error messages
- [ ] **ERR-05**: Never expose stack traces in responses

### MCP Integration

- [ ] **MCP-01**: Register multi_edit tool with proper schema
- [ ] **MCP-02**: Register multi_edit_files tool with proper schema
- [ ] **MCP-03**: Handle ListToolsRequest correctly
- [ ] **MCP-04**: Handle CallToolRequest with proper routing

### Testing

- [ ] **TEST-01**: Unit tests for editor.ts core logic
- [ ] **TEST-02**: Unit tests for validator.ts schemas
- [ ] **TEST-03**: Integration tests for MCP server
- [ ] **TEST-04**: Edge case tests (unicode, large files, empty edits)
- [ ] **TEST-05**: Achieve 90%+ code coverage

### Publishing

- [ ] **PUB-01**: Package as @anthropic-community/eais-mcp-multi-edit
- [ ] **PUB-02**: README with usage examples
- [ ] **PUB-03**: MIT license
- [ ] **PUB-04**: Proper package.json metadata (bin, main, types)

## v2 Requirements

### Enhanced Features

- **ENH-01**: Line-based addressing in addition to string matching
- **ENH-02**: Regex pattern support for find operations
- **ENH-03**: Auto-detect file encoding
- **ENH-04**: File locking for concurrent access

## Out of Scope

| Feature | Reason |
|---------|--------|
| AST-aware editing | Too complex, not aligned with string-based design |
| Undo/history | Rely on dry-run and backups instead |
| Fuzzy matching | Contradicts precision-first philosophy |
| GUI/web interface | CLI/MCP only per design |
| Git integration | Version control is user's responsibility |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EDIT-01 | Phase 1 | Complete |
| EDIT-02 | Phase 1 | Complete |
| EDIT-03 | Phase 1 | Complete |
| EDIT-04 | Phase 1 | Complete |
| EDIT-05 | Phase 1 | Complete |
| EDIT-06 | Phase 1 | Complete |
| EDIT-07 | Phase 1 | Complete |
| EDIT-08 | Phase 7 | Pending |
| EDIT-09 | Phase 7 | Pending |
| SAFE-01 | Phase 4 | Complete |
| SAFE-02 | Phase 3 | Complete |
| SAFE-03 | Phase 3 | Complete |
| SAFE-04 | Phase 5 | Pending |
| SAFE-05 | Phase 1 | Complete |
| ERR-01 | Phase 6 | Pending |
| ERR-02 | Phase 6 | Pending |
| ERR-03 | Phase 6 | Pending |
| ERR-04 | Phase 6 | Pending |
| ERR-05 | Phase 6 | Pending |
| MCP-01 | Phase 2 | Complete |
| MCP-02 | Phase 7 | Pending |
| MCP-03 | Phase 2 | Complete |
| MCP-04 | Phase 2 | Complete |
| TEST-01 | Phase 8 | Pending |
| TEST-02 | Phase 8 | Pending |
| TEST-03 | Phase 9 | Pending |
| TEST-04 | Phase 9 | Pending |
| TEST-05 | Phase 10 | Pending |
| PUB-01 | Phase 11 | Pending |
| PUB-02 | Phase 11 | Pending |
| PUB-03 | Phase 11 | Pending |
| PUB-04 | Phase 11 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-06 after Phase 4 completion*
