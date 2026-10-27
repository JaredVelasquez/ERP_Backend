export interface GatewayRoute {
  prefix: string;
  envName: string;
}

export const GATEWAY_ROUTES: readonly GatewayRoute[] = [
  { prefix: '/identity', envName: 'IDENTITY_URL' },
  { prefix: '/erp', envName: 'ERP_URL' },
  { prefix: '/mcp', envName: 'MCPS_URL' },
  { prefix: '/admin', envName: 'ERP_URL' },
];

export interface ResolvedUpstream {
  prefix: string;
  upstream: string;
}

export function requireGatewayUpstreams(
  env: Readonly<Record<string, string | undefined>>,
): void {
  for (const route of GATEWAY_ROUTES) {
    const value = env[route.envName];
    if (value === undefined || value.trim() === '') {
      throw new Error(`${route.envName} is required`);
    }
  }
}

export function resolveGatewayUpstream(
  pathname: string,
  env: Readonly<Record<string, string | undefined>>,
): ResolvedUpstream | null {
  const match = GATEWAY_ROUTES.find((route) => matchesPrefix(pathname, route.prefix));
  if (!match) {
    return null;
  }
  const upstream = env[match.envName];
  if (upstream === undefined || upstream.trim() === '') {
    throw new Error(`${match.envName} is required`);
  }
  return { prefix: match.prefix, upstream: upstream.replace(/\/$/, '') };
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  if (pathname === prefix) {
    return true;
  }
  return pathname.startsWith(`${prefix}/`);
}
