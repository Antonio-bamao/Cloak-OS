import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, '..');

const helpCases = [
  {
    script: 'src/database/run-migrations.js',
    title: 'migration CLI',
    expected: 'Migration CLI'
  },
  {
    script: 'src/database/run-postgres-smoke-check.js',
    title: 'postgres smoke-check CLI',
    expected: 'PostgreSQL Smoke Check CLI'
  },
  {
    script: 'src/database/run-postgres-api-smoke-check.js',
    title: 'postgres API smoke-check CLI',
    expected: 'PostgreSQL API Smoke Check CLI'
  },
  {
    script: 'src/database/run-postgres-admin-smoke-check.js',
    title: 'postgres admin smoke-check CLI',
    expected: 'PostgreSQL Admin Smoke Check CLI'
  }
];

for (const { script, title, expected } of helpCases) {
  test(`${title} prints help when run as a real subprocess`, async () => {
    const result = await runNodeScript(script, ['--help']);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, new RegExp(expected));
    assert.match(result.stdout, /--help/);
    assert.equal(result.stderr, '');
  });
}

test('migration CLI reports argument errors through subprocess stderr and exit code', async () => {
  const result = await runNodeScript('src/database/run-migrations.js', ['--database-url']);

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Flag --database-url requires a value\./);
});

async function runNodeScript(script, args) {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [path.join(projectRoot, script), ...args],
      {
        cwd: projectRoot,
        windowsHide: true
      }
    );

    return {
      exitCode: 0,
      stdout,
      stderr
    };
  } catch (error) {
    return {
      exitCode: error.code,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? ''
    };
  }
}
