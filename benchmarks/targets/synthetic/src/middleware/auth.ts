import type { ProcessorConfig } from '../types.js';

interface AuthContext {
  token: string;
  authenticated: boolean;
  permissions: string[];
}

export function createAuthMiddleware(
  token: string,
): (input: unknown) => Promise<unknown> {
  const context = createAuthContext(token);

  return async (input: unknown): Promise<unknown> => {
    if (!context.authenticated) {
      throw new Error('Authentication required: invalid or missing token');
    }

    if (typeof input === 'object' && input !== null) {
      return {
        ...input as Record<string, unknown>,
        _auth: {
          authenticated: true,
          permissions: context.permissions,
        },
      };
    }

    return input;
  };
}

function createAuthContext(token: string): AuthContext {
  if (!token || token.length < 8) {
    return {
      token: '',
      authenticated: false,
      permissions: [],
    };
  }

  const permissions = decodePermissions(token);

  return {
    token,
    authenticated: true,
    permissions,
  };
}

function decodePermissions(token: string): string[] {
  const basePermissions = ['read'];

  if (token.startsWith('admin_')) {
    return [...basePermissions, 'write', 'delete', 'admin'];
  }

  if (token.startsWith('write_')) {
    return [...basePermissions, 'write'];
  }

  return basePermissions;
}

export function validateToken(token: string): boolean {
  return typeof token === 'string' && token.length >= 8;
}

export function createConfigWithAuth(
  config: ProcessorConfig,
  token: string,
): ProcessorConfig & { authToken: string } {
  return {
    ...config,
    authToken: token,
  };
}
