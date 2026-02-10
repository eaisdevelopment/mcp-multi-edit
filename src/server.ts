/**
 * EAIS MCP Multi-Edit Server factory
 *
 * Extracted server creation logic for testability via InMemoryTransport.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { handleMultiEdit } from './tools/multi-edit.js';
import { handleMultiEditFiles } from './tools/multi-edit-files.js';
import { createErrorEnvelope, classifyError } from './core/errors.js';

// Tool definitions
const TOOLS = [
  {
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
              old_string: {
                type: 'string',
                description: 'Text to find',
              },
              new_string: {
                type: 'string',
                description: 'Replacement text',
              },
              replace_all: {
                type: 'boolean',
                description: 'Replace all occurrences (default: false)',
              },
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
        backup: {
          type: 'boolean',
          description: 'Create .bak backup file before editing (default: true)',
        },
        include_content: {
          type: 'boolean',
          description: 'Include final file content in response (default: false, use for verification)',
        },
      },
      required: ['file_path', 'edits'],
    },
  },
  {
    name: 'multi_edit_files',
    description: 'Perform coordinated edits across multiple files atomically. All file edits succeed or none apply.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'Absolute path to the file',
              },
              edits: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    old_string: { type: 'string' },
                    new_string: { type: 'string' },
                    replace_all: { type: 'boolean' },
                  },
                  required: ['old_string', 'new_string'],
                },
                minItems: 1,
              },
            },
            required: ['file_path', 'edits'],
          },
          minItems: 1,
          description: 'Array of file edit operations',
        },
        dry_run: {
          type: 'boolean',
          description: 'Preview changes without applying (default: false)',
        },
        backup: {
          type: 'boolean',
          description: 'Ignored for multi-file operations (backups are always created as rollback mechanism). For single-file use multi_edit instead.',
        },
        include_content: {
          type: 'boolean',
          description: 'Include final file content in response (default: false, use for verification)',
        },
      },
      required: ['files'],
    },
  },
];

/**
 * Create and configure an MCP server instance.
 * Does not connect to any transport -- the caller is responsible for that.
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'Multi Edit MCP Server from Essential AI Solutions (essentialai.uk)',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'multi_edit') {
        return await handleMultiEdit(args);
      }

      if (name === 'multi_edit_files') {
        return await handleMultiEditFiles(args);
      }

      const unknownEnvelope = createErrorEnvelope({
        error_code: 'UNKNOWN_TOOL',
        message: `Unknown tool: ${name}`,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(unknownEnvelope, null, 2) }],
        isError: true,
      };
    } catch (error) {
      const classified = classifyError(error);
      const envelope = createErrorEnvelope({
        error_code: classified.error_code,
        message: classified.message,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
        isError: true,
      };
    }
  });

  return server;
}
