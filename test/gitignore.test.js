import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('.gitignore excludes generated local artifacts and dependency directories', async () => {
  const gitignore = await readFile('.gitignore', 'utf8');

  assert.match(gitignore, /^node_modules\/$/m);
  assert.match(gitignore, /^\.pnpm-store\/$/m);
  assert.match(gitignore, /^test-output\/$/m);
});
