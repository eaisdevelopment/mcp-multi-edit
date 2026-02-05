# Architecture

**Analysis Date:** 2026-02-05

## Pattern Overview

**Overall:** Layered MCP (Model Context Protocol) server with clear separation between transport, request handling, validation, business logic, and file I/O.

**Key Characteristics:**
- **MCP-first design**: Built on @modelcontextprotocol/sdk for Claude Code and Claude Desktop integration
- **Atomic operations**: Single-file and multi-file edit tools with all-or-nothing semantics
- **Validation layer**: Zod-based input validation separate from business logic
- **Editor abstraction**: Core file editing logic isolated in editor engine
- **Result formatting**: Consistent response formatting across tools

## Layers

**MCP Transport Layer:**
- Purpose: Handle stdio communication with Claude clients
- Location: `src/index.ts` (lines 1-30, 186-192)
- Contains: Server instantiation, transport setup, request/response routing
- Depends on: @modelcontextprotocol/sdk
- Used by: External Claude clients (Claude Code, Claude Desktop)

**Tool Definition Layer:**
- Purpose: Define tool schemas and parameters for MCP registration
- Location: `src/index.ts` (lines 32-124)
- Contains: Tool name, description, input schema definitions (multi_edit, multi_edit_files)
- Depends on: MCP SDK types
- Used by: ListToolsRequestSchema handler

**Request Handler Layer:**
- Purpose: Route tool calls to appropriate handlers and format responses
- Location: `src/index.ts` (lines 127-183)
- Contains: CallToolRequestSchema handler with try-catch error handling
- Depends on: Tool implementation layers (currently stubbed)
- Used by: MCP framework to dispatch tool invocations

**Validation Layer:**
- Purpose: Ensure input conforms to schema and business rules
- Location: `src/core/validator.ts`
- Contains: Zod schemas, validation functions, path checking, conflict detection
- Depends on: zod library
- Used by: Tool handlers (multi-edit.ts, multi-edit-files.ts)

**Business Logic Layer (Editor Engine):**
- Purpose: Core file editing operations and string replacement
- Location: `src/core/editor.ts`
- Contains: applyEdits (main entry point), replaceString, findOccurrences
- Depends on: Node.js fs/promises API
- Used by: Tool handlers

**Result Formatting Layer:**
- Purpose: Transform operation results into structured MCP responses
- Location: `src/core/reporter.ts`
- Contains: Result formatting functions, success/error result builders, diff generation
- Depends on: Type definitions
- Used by: Tool handlers and request handler

**Tool Handler Layer:**
- Purpose: Orchestrate validation, editing, and response formatting per tool
- Location: `src/tools/multi-edit.ts`, `src/tools/multi-edit-files.ts`
- Contains: Input validation, error handling, result creation
- Depends on: Validator, Editor, Reporter layers
- Used by: Request handler layer

**Type Definitions:**
- Purpose: Define TypeScript interfaces for all data structures
- Location: `src/types/index.ts`
- Contains: EditOperation, MultiEditInput, MultiEditResult, MultiEditFilesResult, EditResult
- Depends on: None
- Used by: All other layers

## Data Flow

**Single-File Edit (multi_edit):**

1. Claude client sends tool call with file_path and edits array
2. MCP framework receives CallToolRequest
3. Request handler dispatches to handleMultiEdit via tool name routing
4. handleMultiEdit validates input against MultiEditInputSchema (validator)
5. Path validation checks for absolute path
6. applyEdits processes edits sequentially:
   - Reads file from disk
   - Applies string replacements in memory
   - Creates backup if requested
   - Writes modified content back to disk (or previews in dry_run mode)
7. Result formatted as MultiEditResult JSON
8. Response sent back to Claude client

**Multi-File Edit (multi_edit_files):**

1. Claude client sends tool call with files array (each with path and edits)
2. MCP framework receives CallToolRequest
3. Request handler dispatches to handleMultiEditFiles
4. handleMultiEditFiles validates input against MultiEditFilesInputSchema
5. All file paths validated for absolute paths
6. For each file: applyEdits called sequentially
7. If any file fails, operation stops and error result returned
8. If all succeed, MultiEditFilesResult with array of file results created
9. Response sent back to client

**State Management:**
- No persistent state maintained in server
- State flows through function parameters and return values
- Original file content preserved in backups (if enabled)
- In-memory edits prevent partial writes

## Key Abstractions

**EditOperation:**
- Purpose: Represents a single find-and-replace action
- Examples: `{ old_string: "foo", new_string: "bar", replace_all: true }`
- Pattern: Data transfer object with optional replace_all flag

**MultiEditResult:**
- Purpose: Report outcome of single-file editing operation
- Contains: success flag, edits_applied count, per-edit results, error details
- Pattern: Structured response that enables clients to understand what succeeded/failed

**MultiEditFilesResult:**
- Purpose: Aggregate result for coordinated multi-file operations
- Contains: file_results array, failed_file_index for atomicity
- Pattern: Composite result providing full operation visibility

**Editor Engine (applyEdits function):**
- Purpose: Atomic application of multiple edits to a single file
- Pattern: Reads file → validates edits in memory → applies all-or-nothing → writes
- Located: `src/core/editor.ts` line 19

**Validator Functions:**
- Purpose: Zod-based input validation + business rule checking
- Examples: validateMultiEditInput, isAbsolutePath, detectOverlappingEdits
- Pattern: safeParse pattern allows graceful error handling

## Entry Points

**Server Startup:**
- Location: `src/index.ts` main() function (lines 186-192)
- Triggers: Direct invocation or npm bin target (eais-mcp-multi-edit)
- Responsibilities: Create Server instance, register handlers, establish stdio transport

**Tool Listing:**
- Location: `src/index.ts` ListToolsRequestSchema handler (lines 127-129)
- Triggers: Claude client requesting available tools
- Responsibilities: Return TOOLS array with multi_edit and multi_edit_files definitions

**Tool Execution:**
- Location: `src/index.ts` CallToolRequestSchema handler (lines 132-183)
- Triggers: Claude client calling multi_edit or multi_edit_files
- Responsibilities: Route to handler, catch errors, format response with isError flag

**Validation Entry:**
- Location: `src/core/validator.ts` validateMultiEditInput/validateMultiEditFilesInput
- Triggers: Tool handlers receiving raw input arguments
- Responsibilities: Parse and validate against Zod schema

**Editing Entry:**
- Location: `src/core/editor.ts` applyEdits function
- Triggers: Tool handlers after input validation
- Responsibilities: File I/O, string replacement logic, atomicity guarantee

## Error Handling

**Strategy:** Graceful degradation with detailed error reporting

**Patterns:**

1. **Validation Errors**: Zod validation failures return structured errors with field paths
   - Location: Tool handlers (multi-edit.ts line 22-28, multi-edit-files.ts line 26-32)
   - Format: "field.path: message" concatenated with semicolons

2. **Path Validation Errors**: Absolute path requirement checked explicitly
   - Location: Tool handlers (multi-edit.ts line 34-39, multi-edit-files.ts line 38-49)
   - Response: isError: true with actionable message

3. **File System Errors**: Caught at applyEdits level
   - Location: Tool handlers try-catch blocks (multi-edit.ts line 41-61, multi-edit-files.ts line 52-115)
   - Behavior: Error result created with message, original file unchanged

4. **Atomicity Enforcement**: Multi-file operations stop on first failure
   - Location: multi-edit-files.ts (lines 77-88)
   - Result: failed_file_index indicates where operation stopped

5. **MCP Protocol Errors**: Wrapper try-catch in request handler
   - Location: src/index.ts (lines 171-182)
   - Response: All errors return isError: true flag for client awareness

## Cross-Cutting Concerns

**Logging:** Not yet implemented (should add console.error for diagnostics)

**Validation:** Centralized in src/core/validator.ts
- Input validation: Zod schemas at layer boundary
- Business rules: detectOverlappingEdits function for conflict detection
- Path validation: isAbsolutePath checks in handlers

**Authentication:** Not applicable (MCP handles client auth at transport level)

**Atomic Operations:**
- Single file: String replacements applied in sequence, all succeed or revert
- Multi-file: All files read → all edits validated in memory → all written together (TODO: implement true atomicity)
- Backup feature: Optional .bak files preserve original state for manual recovery

---

*Architecture analysis: 2026-02-05*
