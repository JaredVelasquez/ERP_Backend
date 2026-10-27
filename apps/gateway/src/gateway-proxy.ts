import { gatewayAllows, readSessionToken } from '@domain/identity/membership/access';
import { resolveGatewayUpstream } from '@domain/gateway/routing/gateway-routes';
import type { RequestHandler } from 'express';
import { createProxyMiddleware, type RequestHandler as ProxyHandler } from 'http-proxy-middleware';

const proxies = new Map<string, ProxyHandler>();

export function createGatewayProxy(): RequestHandler {
  return (request, response, next) => {
    allowLocalFrontend(request, response);
    if (request.method === 'OPTIONS') {
      response.status(204).end();
      return;
    }
    const resolved = resolveGatewayUpstream(request.path, process.env);
    if (!resolved) {
      next();
      return;
    }
    const cookie = typeof request.headers.cookie === 'string' ? request.headers.cookie : undefined;
    const authorization = typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined;
    const hasCredential = readSessionToken({ cookie, authorization }) !== null;
    if (!gatewayAllows(request.method, request.path, hasCredential)) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }
    void proxyFor(resolved.upstream)(request, response, next);
  };
}

function allowLocalFrontend(request: { headers: { origin?: string } }, response: { setHeader(name: string, value: string): void }): void {
  const origin = request.headers.origin;
  if (origin === undefined || !allowedWebOrigins().has(origin)) {
    return;
  }
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  response.setHeader('Vary', 'Origin');
}

function proxyFor(upstream: string): ProxyHandler {
  const existing = proxies.get(upstream);
  if (existing) {
    return existing;
  }
  const created = createProxyMiddleware({
    target: upstream,
    changeOrigin: true,
    on: {
      proxyRes(proxyRes, req) {
        const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
        if (!allowedWebOrigins().has(origin)) {
          return;
        }
        proxyRes.headers['access-control-allow-origin'] = origin;
        proxyRes.headers['access-control-allow-credentials'] = 'true';
      },
    },
  });
  proxies.set(upstream, created);
  return created;
}

function allowedWebOrigins(): Set<string> {
  const configured = process.env.WEB_ORIGINS;
  if (configured === undefined || configured.trim() === '') {
    return new Set(['http://127.0.0.1:5174', 'http://localhost:5174', 'http://127.0.0.1:5175', 'http://localhost:5175']);
  }
  return new Set(configured.split(',').map((origin) => origin.trim()).filter(Boolean));
}
