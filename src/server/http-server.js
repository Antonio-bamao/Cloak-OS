import http from 'node:http';

import { fail } from '../utils/api-response.js';
import { AppError } from '../utils/errors.js';

export function createHttpServer({
  routes,
  logger,
  now = Date.now
}) {
  return http.createServer(async (request, response) => {
    const startedAt = now();
    let statusCode = 500;

    try {
      const matchedRoute = matchRoute(routes, request);

      if (!matchedRoute) {
        throw new AppError('Route not found', 404, 'ROUTE_NOT_FOUND');
      }

      const routeResponse = await matchedRoute.handler(
        await toRouteRequest(request, matchedRoute.params)
      );
      statusCode = routeResponse.statusCode ?? 200;
      sendRouteResponse(response, statusCode, routeResponse);
    } catch (error) {
      statusCode = error instanceof AppError ? error.statusCode : 500;
      sendJson(response, statusCode, fail(error), error.headers);
    } finally {
      logRequest({ logger, request, statusCode, latencyMs: now() - startedAt });
    }
  });
}

function matchRoute(routes, request) {
  const exactKey = getRouteKey(request);

  if (routes[exactKey]) {
    return {
      handler: routes[exactKey],
      params: {}
    };
  }

  for (const [routeKey, handler] of Object.entries(routes)) {
    const params = matchRouteKey(routeKey, request);

    if (params) {
      return { handler, params };
    }
  }

  return null;
}

function getRouteKey(request) {
  const url = new URL(request.url, 'http://localhost');
  return `${request.method} ${url.pathname}`;
}

function matchRouteKey(routeKey, request) {
  const [method, pattern] = routeKey.split(' ');

  if (method !== request.method || !pattern.includes(':')) {
    return null;
  }

  const url = new URL(request.url, 'http://localhost');
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = url.pathname.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params = {};

  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index];
    const pathPart = pathParts[index];

    if (patternPart.startsWith(':')) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart);
      continue;
    }

    if (patternPart !== pathPart) {
      return null;
    }
  }

  return params;
}

async function toRouteRequest(request, params) {
  const url = new URL(request.url, 'http://localhost');

  return {
    method: request.method,
    path: url.pathname,
    params,
    query: Object.fromEntries(url.searchParams.entries()),
    headers: request.headers,
    body: await readJsonBody(request),
    ip: getClientIp(request)
  };
}

function getClientIp(request) {
  const forwardedFor = request.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0].split(',')[0].trim();
  }

  return request.socket.remoteAddress;
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');

  if (!rawBody.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new AppError('Invalid JSON request body', 400, 'INVALID_JSON');
  }
}

function sendJson(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers
  });
  response.end(JSON.stringify(body));
}

function sendRouteResponse(response, statusCode, routeResponse) {
  if (routeResponse.headers) {
    response.writeHead(statusCode, routeResponse.headers);
    response.end(routeResponse.body ?? '');
    return;
  }

  sendJson(response, statusCode, routeResponse.body);
}

function logRequest({ logger, request, statusCode, latencyMs }) {
  if (!logger?.info) {
    return;
  }

  const url = new URL(request.url, 'http://localhost');
  logger.info('HTTP request completed', {
    method: request.method,
    path: url.pathname,
    statusCode,
    latencyMs
  });
}
