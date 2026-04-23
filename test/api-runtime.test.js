import test from 'node:test';
import assert from 'node:assert/strict';

import { createHealthRoute } from '../src/routes/health.routes.js';
import { ok, fail } from '../src/utils/api-response.js';
import { AppError } from '../src/utils/errors.js';
import { createHttpServer } from '../src/server/http-server.js';

test('api response helpers produce the project-wide success and error shapes', () => {
  assert.deepEqual(ok({ status: 'ok' }, '操作成功'), {
    success: true,
    data: { status: 'ok' },
    message: '操作成功'
  });

  assert.deepEqual(fail(new AppError('活动不存在', 404, 'CAMPAIGN_NOT_FOUND')), {
    success: false,
    error: {
      code: 'CAMPAIGN_NOT_FOUND',
      message: '活动不存在'
    }
  });
});

test('health route reports service status with uptime and version', async () => {
  const healthRoute = createHealthRoute({
    now: () => 1_700_000_005_000,
    startedAt: 1_700_000_000_000,
    version: '0.1.0'
  });

  const response = await healthRoute();

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    data: {
      status: 'ok',
      uptimeSeconds: 5,
      version: '0.1.0'
    },
    message: 'ok'
  });
});

test('HTTP server adapts route responses to JSON over Node http', async () => {
  const server = createHttpServer({
    routes: {
      'GET /health': async () => ({
        statusCode: 200,
        body: ok({ status: 'ok' }, 'ok')
      })
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/health`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.deepEqual(await response.json(), {
      success: true,
      data: { status: 'ok' },
      message: 'ok'
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('HTTP server converts AppError exceptions to unified error responses', async () => {
  const server = createHttpServer({
    routes: {
      'GET /missing': async () => {
        throw new AppError('活动不存在', 404, 'CAMPAIGN_NOT_FOUND');
      }
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/missing`);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      success: false,
      error: {
        code: 'CAMPAIGN_NOT_FOUND',
        message: '活动不存在'
      }
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('HTTP server returns a unified 404 for unknown routes', async () => {
  const server = createHttpServer({ routes: {} });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/unknown`);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Route not found'
      }
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
