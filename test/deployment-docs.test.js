import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('production deployment assets document postgres-backed Docker deployment', async () => {
  const dockerfile = await readFile('Dockerfile', 'utf8');
  const dockerignore = await readFile('.dockerignore', 'utf8');
  const compose = await readFile('docker-compose.prod.yml', 'utf8');
  const deployment = await readFile('docs/DEPLOYMENT.md', 'utf8');
  const readme = await readFile('README.md', 'utf8');

  assert.match(dockerfile, /FROM node:20/);
  assert.match(dockerfile, /pnpm install --prod --frozen-lockfile/);
  assert.match(dockerfile, /CMD \["npm", "start"\]/);
  assert.match(dockerignore, /^node_modules$/m);
  assert.match(dockerignore, /^test-output$/m);
  assert.match(compose, /cloak-app/);
  assert.match(compose, /cloak-postgres/);
  assert.match(compose, /REPOSITORY_DRIVER=postgres/);
  assert.match(compose, /DATABASE_URL=/);
  assert.match(compose, /ADMIN_TOKEN=/);
  assert.doesNotMatch(compose, /5432:5432/);
  assert.match(deployment, /docker compose .* -f docker-compose\.prod\.yml up -d postgres/);
  assert.match(deployment, /npm run migrate/);
  assert.match(deployment, /npm run smoke:postgres-api/);
  assert.match(deployment, /\/health/);
  assert.match(deployment, /# 生产部署/);
  assert.match(deployment, /前置条件/);
  assert.match(deployment, /创建生产环境变量/);
  assert.match(deployment, /启动 PostgreSQL/);
  assert.doesNotMatch(deployment, /# Production Deployment/);
  assert.doesNotMatch(deployment, /## Prerequisites/);
  assert.match(readme, /docs\/DEPLOYMENT\.md/);
  assert.match(readme, /docs\/USAGE\.md/);
});

test('usage guide explains bot safe page and human money page verification', async () => {
  const usage = await readFile('docs/USAGE.md', 'utf8');

  assert.match(usage, /safeUrl/);
  assert.match(usage, /moneyUrl/);
  assert.match(usage, /白页/);
  assert.match(usage, /黑页|黑夜/);
  assert.match(usage, /BOT_IPS/);
  assert.match(usage, /Googlebot/);
  assert.match(usage, /\/c\/:campaignId/);
  assert.match(usage, /Authorization: Bearer/);
  assert.match(usage, /verdict/);
  assert.match(usage, /action/);
  assert.match(usage, /# 斗篷系统使用手册/);
  assert.match(usage, /核心概念/);
  assert.match(usage, /测试：机器人看白页，真人看黑页/);
  assert.doesNotMatch(usage, /# Cloak Usage Guide/);
  assert.doesNotMatch(usage, /## Core Idea/);
  assert.doesNotMatch(usage, /Expected result/);
});
