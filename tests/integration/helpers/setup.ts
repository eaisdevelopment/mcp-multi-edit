/**
 * Integration test helpers for MCP server testing.
 *
 * Provides client creation (via InMemoryTransport), temp directory management,
 * and response parsing utilities.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from '../../../src/server.js';

/**
 * Create a connected MCP client for integration testing.
 *
 * Uses InMemoryTransport to connect a Client to a Server in-process.
 * Server is connected first, then client initiates the MCP handshake.
 *
 * Returns the client and a cleanup function that closes the transport.
 */
export async function createTestClient(): Promise<{
  client: Client;
  cleanup: () => Promise<void>;
}> {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  // Connect server first -- it must be ready before client initiates handshake
  await server.connect(serverTransport);

  const client = new Client(
    { name: 'integration-test-client', version: '1.0.0' },
    {}
  );
  await client.connect(clientTransport);

  return {
    client,
    cleanup: async () => {
      await clientTransport.close();
    },
  };
}

/**
 * Create a temporary directory with resolved path.
 *
 * On macOS, /tmp is a symlink to /private/tmp. This function resolves
 * the symlink via realpath() so paths match what the validator returns.
 */
export async function createTempDir(): Promise<string> {
  const raw = await mkdtemp(join(tmpdir(), 'mcp-integ-'));
  return await realpath(raw);
}

/**
 * Create a test file with content in the given directory.
 * Returns the full absolute path to the created file.
 */
export async function createTestFile(
  dir: string,
  name: string,
  content: string
): Promise<string> {
  const filePath = join(dir, name);
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Clean up a temporary directory and all its contents.
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

/**
 * Parse a callTool result into a typed object.
 *
 * Extracts the JSON text from the first content block, parses it,
 * and returns the parsed object alongside the isError flag.
 */
export function parseToolResult(result: {
  content: unknown;
  isError?: boolean;
}): { parsed: Record<string, unknown>; isError: boolean | undefined } {
  const text = (result.content as Array<{ type: string; text: string }>)[0].text;
  const parsed = JSON.parse(text) as Record<string, unknown>;
  return { parsed, isError: result.isError };
}
