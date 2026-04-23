import test from 'node:test';
import assert from 'node:assert/strict';

import { BearerTokenAuthService } from '../src/auth/bearer-token-auth.service.js';
import { createAuthenticatedRoutes } from '../src/routes/authenticated-routes.js';
import { ok } from '../src/utils/api-response.js';

test('BearerTokenAuthService accepts a matching Authorization bearer token', () => {
  const auth = new BearerTokenAuthService({ token: 'dev-admin-token' });

  assert.equal(
    auth.authenticate({ authorization: 'Bearer dev-admin-token' }).authenticated,
    true
  );
});

test('BearerTokenAuthService rejects missing or invalid Authorization headers', () => {
  const auth = new BearerTokenAuthService({ token: 'dev-admin-token' });

  assert.equal(auth.authenticate({}).authenticated, false);
  assert.equal(auth.authenticate({ authorization: 'Bearer wrong' }).authenticated, false);
});

test('createAuthenticatedRoutes wraps routes without changing their handlers', async () => {
  const routes = createAuthenticatedRoutes(
    {
      'GET /api/v1/campaigns': async () => ({
        statusCode: 200,
        body: ok([], 'Campaigns fetched')
      })
    },
    new BearerTokenAuthService({ token: 'dev-admin-token' })
  );

  await assert.rejects(
    () => routes['GET /api/v1/campaigns']({ headers: {} }),
    (error) => {
      assert.equal(error.statusCode, 401);
      assert.equal(error.errorCode, 'AUTH_REQUIRED');
      assert.deepEqual(error.headers, {
        'WWW-Authenticate': 'Bearer'
      });
      return true;
    }
  );

  assert.deepEqual(
    await routes['GET /api/v1/campaigns']({
      headers: { authorization: 'Bearer dev-admin-token' }
    }),
    {
      statusCode: 200,
      body: {
        success: true,
        data: [],
        message: 'Campaigns fetched'
      }
    }
  );
});
