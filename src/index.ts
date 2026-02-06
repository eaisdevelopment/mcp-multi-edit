#!/usr/bin/env node
/**
 * EAIS MCP Multi-Edit Server
 *
 * Provides atomic multi-edit capabilities for Claude Code and Claude Desktop.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { handleMultiEdit } from './tools/multi-edit.js';
// TODO: Import multi_edit_files handler when implemented
// import { handleMultiEditFiles } from './tools/multi-edit-files.js';

const server = new Server(
  {
    name: 'eais-mcp-multi-edit',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

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
          description: 'Create .bak backup files before editing (default: true)',
        },
      },
      required: ['files'],
    },
  },
];

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
      // TODO: Implement
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'Not implemented yet' }),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: `Unknown tool: ${name}` }),
        },
      ],
      isError: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: message }),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('EAIS MCP Multi-Edit Server running on stdio');
}

main().catch(console.error);
