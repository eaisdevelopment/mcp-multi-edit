# Phase 2: Single-File Tool Wiring - Research

**Researched:** 2026-02-05
**Domain:** MCP tool handler implementation, JSON response formatting, error presentation
**Confidence:** HIGH

## Summary

This phase wires the `multi_edit` MCP tool handler to invoke the Phase 1 editor engine (`applyEdits`) and return structured JSON responses. The research confirms that the existing `src/index.ts` already has the correct MCP server setup with `ListToolsRequestSchema` and `CallToolRequestSchema` handlers scaffolded - only the tool handler implementation needs completion.

Key implementation requirements from CONTEXT.md decisions:
1. **Detailed responses** with per-edit confirmation (matches, occurrences replaced)
2. **Error context snippets** (~50 chars around expected match location)
3. **Recovery hints** for common errors (file not found, permission denied, match failures)
4. **Optional `include_content` flag** to include final file content in response
5. **Atomicity guarantee** surfaced in error messages ("none applied, file unchanged")

The MCP SDK uses a specific response format: `{ content: [{ type: 'text', text: string }], isError?: boolean }`. The `isError` flag indicates tool execution failures (not protocol errors). All structured data must be JSON-stringified into the `text` field.

**Primary recommendation:** Implement `handleMultiEdit` in `src/tools/multi-edit.ts` to call `applyEdits`, then transform the `MultiEditResult` into MCP response format with enhanced error context and recovery hints per CONTEXT.md decisions.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | 1.0.0+ | MCP protocol implementation | Official SDK, already in project |
| Zod | 3.23+ | Input validation | Already in project, integrates with SDK |
| Node.js built-ins | 20+ | Path handling, string ops | No additional deps needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing editor.ts | N/A | Core edit logic | Invoke `applyEdits` from handler |
| Existing validator.ts | N/A | Input validation | Use `validateMultiEditInput` |
| Existing reporter.ts | N/A | Result formatting | Extend with enhanced error context |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON.stringify in response | SDK structured output | SDK structured output is newer (2025-06-18 spec) but requires outputSchema; JSON.stringify in text is backward-compatible and sufficient |

**Installation:**
```bash
# No new dependencies needed - using existing project deps
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  index.ts              # MCP server (already wired, needs handler import)
  tools/
    multi-edit.ts       # Tool handler (implement here)
  core/
    editor.ts           # applyEdits (Phase 1 complete)
    validator.ts        # Zod validation (exists)
    reporter.ts         # Result formatting (extend for error context)
  types/
    index.ts            # Type definitions (exists)
```

### Pattern 1: MCP Tool Handler Response Format

**What:** Transform internal result to MCP response with content array and isError flag.

**When to use:** All tool handlers.

**Example:**
```typescript
// Source: MCP specification (2025-06-18) and official TypeScript SDK examples
export async function handleMultiEdit(args: unknown): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  // Validate input
  const validation = validateMultiEditInput(args);
  if (!validation.success) {
    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: false,
        error: formatValidationError(validation.error)
      }) }],
      isError: true,
    };
  }

  // Execute
  const result = await applyEdits(...);

  // Transform to MCP response
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    isError: !result.success,
  };
}
```

### Pattern 2: Error Context Snippet

**What:** Include surrounding content (50 chars) when match fails.

**When to use:** Match not found errors per CONTEXT.md decision.

**Example:**
```typescript
// Source: CONTEXT.md decisions - Error presentation
function createMatchErrorContext(
  content: string,
  searchString: string,
  maxContext: number = 50
): string {
  // Find most similar location using fuzzy matching heuristic
  // For now, show beginning of file as context
  const preview = content.substring(0, maxContext);
  const truncated = preview.length < content.length;
  return `File begins with: "${preview}${truncated ? '...' : ''}"`;
}

function formatMatchError(
  edit: EditOperation,
  editIndex: number,
  totalEdits: number,
  content: string
): string {
  const context = createMatchErrorContext(content, edit.old_string);
  return `Edit ${editIndex + 1} of ${totalEdits} failed: ` +
    `String "${truncate(edit.old_string, 30)}" not found. ` +
    `${context}. ` +
    `Recovery: Read the file to see current content, then retry with correct old_string.`;
}
```

### Pattern 3: Recovery Hints

**What:** Actionable hints for common errors.

**When to use:** All error responses per CONTEXT.md decision.

**Example:**
```typescript
// Source: CONTEXT.md decisions - Recovery hints should be actionable
const RECOVERY_HINTS = {
  ENOENT: 'Check that file exists at the specified path.',
  EACCES: 'Check file permissions. Try running with appropriate access.',
  EPERM: 'Operation not permitted. File may be read-only or locked.',
  MATCH_FAILED: 'Read the file to see current content, then retry with correct old_string.',
  MULTIPLE_MATCHES: 'Use replace_all: true to replace all occurrences, or make old_string more specific.',
  UTF8_INVALID: 'File is not valid UTF-8. Ensure file uses UTF-8 encoding.',
};

function getRecoveryHint(errorCode: string): string {
  return RECOVERY_HINTS[errorCode] || 'Check error details and retry.';
}
```

### Pattern 4: Success Response with Per-Edit Details

**What:** Detailed response showing each edit's status.

**When to use:** Successful multi_edit operations.

**Example:**
```typescript
// Source: CONTEXT.md decisions - Response shape
interface MultiEditResponse {
  success: true;
  file_path: string;
  edits_applied: number;
  edits: Array<{
    old_string: string;
    matched: boolean;
    occurrences_replaced: number;
  }>;
  final_content?: string;  // Only if include_content: true
}

function formatSuccessResponse(
  result: MultiEditResult,
  includeContent: boolean
): MultiEditResponse {
  return {
    success: true,
    file_path: result.file_path,
    edits_applied: result.edits_applied,
    edits: result.results.map(r => ({
      old_string: r.old_string,
      matched: r.success && r.matches > 0,
      occurrences_replaced: r.replaced,
    })),
    ...(includeContent && result.final_content ? { final_content: result.final_content } : {}),
  };
}
```

### Pattern 5: Wiring Handler to MCP Server

**What:** Import and dispatch to handler in CallToolRequestSchema handler.

**When to use:** src/index.ts tool routing.

**Example:**
```typescript
// Source: Official MCP TypeScript SDK patterns
import { handleMultiEdit } from './tools/multi-edit.js';

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'multi_edit') {
      return await handleMultiEdit(args);
    }
    // ... other tools ...

    return {
      content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
      isError: true,
    };
  } catch (error) {
    // Unexpected errors (protocol level)
    return {
      content: [{ type: 'text', text: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }) }],
      isError: true,
    };
  }
});
```

### Anti-Patterns to Avoid
- **Throwing errors from handler:** Return `isError: true` response instead of throwing
- **Returning non-JSON text:** Always JSON.stringify structured data
- **Missing isError flag on failures:** Claude needs this to understand operation failed
- **Verbose error messages without actionable hints:** Include recovery suggestions
- **Including final_content by default:** Large files waste tokens; use opt-in flag

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Input validation | Manual type checking | `validateMultiEditInput` (exists) | Zod provides type inference, clear errors |
| Edit execution | New implementation | `applyEdits` from editor.ts (exists) | Phase 1 complete, tested, atomic |
| Result formatting | Ad-hoc JSON building | `formatMultiEditResult` (exists) | Consistent structure |
| Path validation | String checks | `isAbsolutePath` (exists) | Handles edge cases |

**Key insight:** Phase 1 built the engine. This phase is pure wiring - call existing functions, format responses.

## Common Pitfalls

### Pitfall 1: Forgetting isError Flag

**What goes wrong:** Claude doesn't recognize operation failed, may proceed incorrectly.
**Why it happens:** Easy to return content without isError when result.success is false.
**How to avoid:** Always set `isError: !result.success` in response.
**Warning signs:** Claude treats error messages as successful output.

### Pitfall 2: Error Without Context

**What goes wrong:** "String not found" with no hint about what content exists.
**Why it happens:** Returning Phase 1 error message verbatim without enhancement.
**How to avoid:** Add context snippet (~50 chars) showing actual file content.
**Warning signs:** Claude repeatedly tries same old_string that doesn't match.

### Pitfall 3: Missing Atomicity Communication

**What goes wrong:** User/Claude unclear if partial edits applied.
**Why it happens:** Error message doesn't clarify file state.
**How to avoid:** Error messages must include "none applied, file unchanged".
**Warning signs:** User uncertain about file state after error.

### Pitfall 4: Large File Content in Response

**What goes wrong:** Response too large, wastes tokens, slow.
**Why it happens:** Always including file content.
**How to avoid:** Only include when `include_content: true`.
**Warning signs:** Slow responses, token limit errors.

### Pitfall 5: Schema Mismatch

**What goes wrong:** Tool lists one schema but handler expects different shape.
**Why it happens:** TOOLS array in index.ts not matching validator schema.
**How to avoid:** Include `include_content` in inputSchema, match validator exactly.
**Warning signs:** Validation errors on valid-looking input.

## Code Examples

Verified patterns from official sources and CONTEXT.md decisions:

### Complete handleMultiEdit Implementation
```typescript
// Source: MCP SDK patterns + CONTEXT.md decisions
import { applyEdits } from '../core/editor.js';
import { validateMultiEditInput, isAbsolutePath } from '../core/validator.js';
import type { MultiEditInput, MultiEditResult } from '../types/index.js';

export async function handleMultiEdit(args: unknown): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  // 1. Validate input with Zod
  const validation = validateMultiEditInput(args);
  if (!validation.success) {
    const errorMessage = validation.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: `Validation failed: ${errorMessage}`,
          recovery_hint: 'Check input parameters match the expected schema.'
        })
      }],
      isError: true,
    };
  }

  const input = validation.data as MultiEditInput;

  // 2. Validate absolute path
  if (!isAbsolutePath(input.file_path)) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: 'file_path must be an absolute path',
          recovery_hint: 'Provide full path starting with / (e.g., /Users/...).'
        })
      }],
      isError: true,
    };
  }

  // 3. Apply edits using Phase 1 engine
  const result = await applyEdits(
    input.file_path,
    input.edits,
    input.dry_run ?? false,
    input.create_backup ?? false
  );

  // 4. Format response per CONTEXT.md decisions
  const response = formatResponse(result, input.include_content ?? false);

  return {
    content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
    isError: !result.success,
  };
}

function formatResponse(
  result: MultiEditResult,
  includeContent: boolean
): object {
  if (!result.success) {
    return {
      success: false,
      file_path: result.file_path,
      error: result.error,
      failed_edit_index: result.failed_edit_index,
      edits_applied: 0,
      message: 'Operation failed. No changes applied - file unchanged.',
      recovery_hint: getRecoveryHintFromError(result.error),
    };
  }

  const response: Record<string, unknown> = {
    success: true,
    file_path: result.file_path,
    edits_applied: result.edits_applied,
    dry_run: result.dry_run,
    edits: result.results.map(r => ({
      old_string: truncateForDisplay(r.old_string, 50),
      matched: r.success,
      occurrences_replaced: r.replaced,
    })),
  };

  if (result.backup_path) {
    response.backup_path = result.backup_path;
  }

  if (includeContent && result.final_content !== undefined) {
    response.final_content = result.final_content;
  }

  return response;
}

function getRecoveryHintFromError(error?: string): string {
  if (!error) return 'Unknown error. Retry the operation.';
  if (error.includes('not found')) return 'Read the file to see current content, then retry with correct old_string.';
  if (error.includes('Permission denied')) return 'Check file permissions.';
  if (error.includes('matches at lines')) return 'Use replace_all: true or make old_string more specific.';
  return 'Check error details and retry.';
}

function truncateForDisplay(str: string, maxLen: number): string {
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}
```

### Updated Tool Definition with include_content
```typescript
// Source: MCP specification - inputSchema format
const MULTI_EDIT_TOOL = {
  name: 'multi_edit',
  description: 'Perform multiple find-and-replace operations on a single file atomically. All edits succeed or none apply.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      file_path: {
        type: 'string',
        description: 'Absolute path to the file to modify',
      },
      edits: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            old_string: { type: 'string', description: 'Text to find' },
            new_string: { type: 'string', description: 'Replacement text' },
            replace_all: { type: 'boolean', description: 'Replace all occurrences (default: false)' },
          },
          required: ['old_string', 'new_string'],
        },
        minItems: 1,
        description: 'Array of edit operations (applied sequentially)',
      },
      dry_run: {
        type: 'boolean',
        description: 'Preview changes without applying (default: false)',
      },
      create_backup: {
        type: 'boolean',
        description: 'Create .bak backup file before editing (default: false)',
      },
      include_content: {
        type: 'boolean',
        description: 'Include final file content in response (default: false, use for verification)',
      },
    },
    required: ['file_path', 'edits'],
  },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| toolResult field | content array + isError | MCP spec 2025-06-18 | Backward-compatible via text content |
| Unstructured errors | structuredContent (optional) | MCP spec 2025-06-18 | Can use JSON in text for compatibility |
| Always return full content | Optional include_content flag | Current best practice | Reduces token usage |

**Deprecated/outdated:**
- `toolResult` response field: Use `content` array with TextContent
- Protocol-level errors for tool failures: Use `isError: true` for execution errors

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal context snippet length**
   - What we know: CONTEXT.md specifies ~50 chars
   - What's unclear: Whether to show file start, matched area, or fuzzy-match location
   - Recommendation: Start with file beginning; iterate based on user feedback

2. **Error response verbosity vs. token efficiency**
   - What we know: Detailed errors help Claude self-correct
   - What's unclear: How much detail is too much
   - Recommendation: Include edit position, context, and recovery hint; measure impact

## Sources

### Primary (HIGH confidence)
- MCP specification (2025-06-18) - Tool response format, isError semantics
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - CallToolRequestSchema, setRequestHandler patterns
- [MCP Tools Concepts](https://modelcontextprotocol.io/docs/concepts/tools) - Content types, error handling
- CONTEXT.md - Response shape, error presentation decisions

### Secondary (MEDIUM confidence)
- [How to build MCP servers with TypeScript SDK](https://dev.to/shadid12/how-to-build-mcp-servers-with-typescript-sdk-1c28) - Handler implementation patterns
- [Build Your First MCP Server with TypeScript](https://hackteam.io/blog/build-your-first-mcp-server-with-typescript-in-under-10-minutes/) - Complete example

### Tertiary (LOW confidence)
- [MCP tool best practices](https://www.merge.dev/blog/mcp-tool-description) - General guidance on tool design

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing SDK and project code
- Architecture: HIGH - Clear patterns from MCP spec and Phase 1 foundation
- Pitfalls: HIGH - Well-documented in MCP ecosystem

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (MCP spec stable, 30 days validity)
