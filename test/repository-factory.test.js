import test from 'node:test';
import assert from 'node:assert/strict';

import { AppError } from '../src/utils/errors.js';
import { createRepositories } from '../src/repositories/factory.js';
import { InMemoryAccessLogRepository } from '../src/repositories/access-log.repo.js';
import { InMemoryCampaignRepository } from '../src/repositories/campaign.repo.js';
import { PostgresAccessLogRepository } from '../src/repositories/postgres/access-log.repo.js';
import { PostgresCampaignRepository } from '../src/repositories/postgres/campaign.repo.js';

test('createRepositories returns in-memory repositories by default', () => {
  const repositories = createRepositories({
    config: {
      repository: {
        driver: 'memory'
      }
    }
  });

  assert.ok(repositories.campaignRepository instanceof InMemoryCampaignRepository);
  assert.ok(repositories.accessLogRepository instanceof InMemoryAccessLogRepository);
});

test('createRepositories returns postgres repositories when a postgres client is injected', () => {
  const postgresClient = { query() {} };
  const repositories = createRepositories({
    config: {
      repository: {
        driver: 'postgres'
      }
    },
    postgresClient
  });

  assert.ok(repositories.campaignRepository instanceof PostgresCampaignRepository);
  assert.ok(repositories.accessLogRepository instanceof PostgresAccessLogRepository);
});

test('createRepositories rejects postgres driver without an injected client', () => {
  assert.throws(
    () => createRepositories({
      config: {
        repository: {
          driver: 'postgres'
        }
      }
    }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.errorCode, 'REPOSITORY_CLIENT_REQUIRED');
      assert.match(error.message, /postgresClient/);
      return true;
    }
  );
});
