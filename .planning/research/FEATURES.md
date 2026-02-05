# Feature Landscape

**Domain:** MCP Multi-Edit Tools for Claude Code/Desktop
**Researched:** 2026-02-05
**Confidence:** HIGH (verified against Claude's text editor tool docs, MCP filesystem server, and MCP SDK)

## Executive Summary

MCP file editing tools occupy a specific niche: enabling AI agents to make precise, safe modifications to source files. The value proposition is **atomicity** (all edits succeed or none apply) combined with **reduced context usage** (multiple edits in one tool call vs. multiple tool calls).

Key insight: Claude's built-in Edit tool already handles single-file, single-replacement edits well. The multi-edit tools differentiate by supporting **batched edits** in a single call and **cross-file atomicity**.

---

## Table Stakes

Features users expect. Missing = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Exact string matching** | Claude's edit paradigm requires precise matches | Low | None | Must match exactly including whitespace, indentation |
| **Single-file multi-edit** | Core value proposition - batch multiple changes | Medium | Conflict detection | Apply multiple find-replace operations atomically |
| **Clear error messages** | Users need actionable feedback on failures | Low | None | "No match found", "Multiple matches found (expected 1)", etc. |
| **Non-unique match detection** | Prevents unintended edits to wrong location | Low | None | Fail if old_string matches >1 location (unless replace_all) |
| **Replace all option** | Common need for renaming variables, imports | Low | None | Per-edit flag to replace all occurrences |
| **Dry-run mode** | Preview changes before applying | Medium | Result formatting | Return what would change without modifying files |
| **File existence validation** | Prevent cryptic errors | Low | None | Clear error if file doesn't exist |
| **Path validation** | Security and usability | Low | None | Reject relative paths, validate absolute paths |
| **Permission error handling** | Graceful failure on read-only files | Low | None | Clear error message, no partial state |
| **UTF-8 support** | Modern codebases use Unicode | Low | None | Handle Unicode correctly in search/replace |
| **Whitespace preservation** | Code indentation is semantic | Low | None | Preserve exact whitespace in replacements |
| **MCP-compliant responses** | Integration requirement | Low | None | Proper content array, isError flag usage |

---

## Differentiators

Features that set the product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Multi-file atomic edits** | Cross-file refactoring without partial state | High | Transaction management | All files succeed or all rollback - key differentiator |
| **Overlap/conflict detection** | Prevent edits that would interfere with each other | Medium | Edit ordering | Detect if edit A changes text that edit B needs to find |
| **Backup files (.bak)** | Recovery from mistakes | Low | None | Optional flag to create backup before editing |
| **Edit result summary** | Clear feedback on what changed | Medium | None | "Changed 3 locations in 2 files" with details |
| **Match context in errors** | Help user understand failures | Medium | None | Show surrounding lines when reporting non-unique matches |
| **Line number reporting** | Easier debugging | Low | None | Report which line numbers were modified |
| **Indentation detection** | Smart whitespace handling | Medium | Parsing | Detect file's indentation style (tabs vs spaces, width) |
| **Structured output** | Machine-readable results | Low | None | Return structured data alongside text for programmatic use |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Regex support** | Complexity explosion, error-prone, conflicts with exactness principle | Use exact string matching only. Users who need regex can use other tools |
| **Partial file loading** | Claude already has this in Read tool | Not needed - this tool focuses on edits, not viewing |
| **File creation** | Scope creep, already handled by Write tool | Return error if file doesn't exist, don't create |
| **Directory operations** | Scope creep, different concern | Focus on file content editing only |
| **AST-aware editing** | Massive complexity, language-specific | Keep it simple - text-based find/replace works universally |
| **Merge conflict markers** | Different paradigm (git), complexity | Fail on conflicts rather than leaving markers |
| **Undo/history tracking** | State management complexity, Claude 4 removed this | Rely on dry-run and backups, let git handle history |
| **Automatic formatting** | Opinionated, can break code | Preserve exact formatting, let user/formatter handle style |
| **Fuzzy matching** | Violates precision principle, unpredictable | Exact matches only - precision over convenience |
| **Interactive prompts** | MCP tools are non-interactive | Return clear errors, let client handle retries |
| **Watch mode / live reload** | Different concern (tooling), complexity | Single-shot operations only |

---

## Feature Dependencies

```
                    ┌─────────────────────┐
                    │  Path Validation    │
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              v               v               v
    ┌─────────────────┐ ┌───────────┐ ┌────────────────┐
    │ File Existence  │ │ Read File │ │ Permission     │
    │ Validation      │ │           │ │ Check          │
    └────────┬────────┘ └─────┬─────┘ └───────┬────────┘
             │                │               │
             └────────────────┼───────────────┘
                              │
                              v
                    ┌─────────────────────┐
                    │ String Matching     │◄──── Non-unique detection
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              v               v               v
    ┌─────────────────┐ ┌───────────┐ ┌────────────────┐
    │ Overlap         │ │ Apply     │ │ Dry-run Mode   │
    │ Detection       │ │ Edits     │ │                │
    └────────┬────────┘ └─────┬─────┘ └───────┬────────┘
             │                │               │
             └────────────────┼───────────────┘
                              │
                              v
              ┌───────────────────────────────┐
              │ Single-file Multi-edit        │
              └───────────────┬───────────────┘
                              │
                              v
              ┌───────────────────────────────┐
              │ Multi-file Atomic Edits       │◄──── Requires transaction management
              └───────────────────────────────┘
```

**Critical Path:** Path validation -> File read -> String matching -> Apply edits

**Key dependencies:**
- Overlap detection requires edit ordering logic
- Multi-file atomicity requires single-file edits to work first
- Dry-run shares logic with actual apply, just skips write
- Backup feature can be added independently at any point

---

## MVP Recommendation

For MVP, prioritize:

1. **Single-file multi-edit with atomicity** - Core value proposition
2. **Non-unique match detection** - Safety critical
3. **Replace all option** - Common use case
4. **Dry-run mode** - Risk mitigation for users
5. **Clear error messages** - Usability critical

**Defer to post-MVP:**
- Multi-file atomic edits: Complexity is higher, single-file covers 80% of use cases
- Backup files: Nice to have, users can rely on git
- Overlap detection: Complex, can add after gathering real usage patterns
- Line number reporting: Enhancement, not critical

---

## Comparison: Claude Edit vs multi_edit

| Aspect | Claude Edit Tool | multi_edit |
|--------|------------------|------------|
| Edits per call | 1 | Many |
| Files per call | 1 | 1 (multi_edit_files for multiple) |
| Atomicity | Single edit | All edits or none |
| Replace all | Via replace_all param | Via per-edit flag |
| Dry run | No | Yes |
| Context usage | Higher (multiple calls) | Lower (batched) |
| Uniqueness | Required | Required (unless replace_all) |

**The multi_edit differentiation:** Reduced context window usage through batching + atomicity guarantee across multiple edits.

---

## Sources

**HIGH Confidence (Official Documentation):**
- [Claude Text Editor Tool - Anthropic Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/text-editor-tool) - Commands: view, str_replace, create, insert, undo_edit
- [MCP Filesystem Server - GitHub](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) - edit_file tool schema with oldText/newText/dryRun
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Tool registration patterns, error handling

**MEDIUM Confidence (Verified with multiple sources):**
- [MCP Filesystem Server - PulseMCP](https://www.pulsemcp.com/servers/modelcontextprotocol-filesystem) - 13 tools documented
- [Filesystem MCP Server Guide - Stacklok](https://docs.stacklok.com/toolhive/guides-mcp/filesystem) - Security model, allowed directories

**LOW Confidence (WebSearch only - patterns observed):**
- AI coding tools comparison articles suggest multi-file refactoring is emerging differentiator
- Batch text replacement tools typically offer backup and dry-run features
