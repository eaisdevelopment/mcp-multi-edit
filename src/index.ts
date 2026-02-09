#!/usr/bin/env node
/**
 * EAIS MCP Multi-Edit Server entry point
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

const server = createServer();

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('EAIS MCP Multi-Edit Server running on stdio');
}

main().catch(console.error);
