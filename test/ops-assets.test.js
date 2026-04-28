import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('production ops assets include nginx TLS proxy and database backup scripts', async () => {
  const nginx = await readFile('deploy/nginx/cloak.conf.example', 'utf8');
  const backup = await readFile('scripts/backup-postgres.ps1', 'utf8');
  const restore = await readFile('scripts/restore-postgres.ps1', 'utf8');
  const drill = await readFile('scripts/verify-postgres-restore.ps1', 'utf8');
  const deployment = await readFile('docs/DEPLOYMENT.md', 'utf8');
  const gitignore = await readFile('.gitignore', 'utf8');
  const dockerignore = await readFile('.dockerignore', 'utf8');

  assert.match(nginx, /server_name cloak\.example\.com/);
  assert.match(nginx, /ssl_certificate/);
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:3000/);
  assert.match(nginx, /proxy_set_header X-Forwarded-For/);
  assert.match(nginx, /location \/admin/);
  assert.match(nginx, /allow 127\.0\.0\.1/);
  assert.doesNotMatch(nginx, /5432/);

  assert.match(backup, /pg_dump/);
  assert.match(backup, /docker compose/);
  assert.match(backup, /backups/);
  assert.match(backup, /--clean --if-exists/);

  assert.match(restore, /CLOAK_CONFIRM_RESTORE/);
  assert.match(restore, /psql/);
  assert.match(restore, /docker compose/);
  assert.match(restore, /throw "Backup file not found/);

  assert.match(drill, /docker run/);
  assert.match(drill, /postgres:16-alpine/);
  assert.match(drill, /pg_isready/);
  assert.match(drill, /psql/);
  assert.match(drill, /run-migrations\.js --status/);
  assert.match(drill, /run-postgres-smoke-check\.js/);
  assert.match(drill, /run-postgres-api-smoke-check\.js/);
  assert.match(drill, /docker stop/);
  assert.match(drill, /finally/);
  assert.match(drill, /Backup file not found/);

  assert.match(deployment, /Nginx/);
  assert.match(deployment, /backup-postgres\.ps1/);
  assert.match(deployment, /restore-postgres\.ps1/);
  assert.match(deployment, /verify-postgres-restore\.ps1/);
  assert.match(deployment, /恢复演练/);
  assert.match(deployment, /LOG_MAX_BYTES/);
  assert.match(deployment, /LOG_MAX_FILES/);
  assert.match(gitignore, /^backups\/$/m);
  assert.match(gitignore, /^logs\/$/m);
  assert.match(dockerignore, /^backups$/m);
  assert.match(dockerignore, /^logs$/m);
});
