import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';

const CREATE_SCHEMA_MIGRATIONS_SQL = `CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;

const LIST_APPLIED_MIGRATIONS_SQL =
  'SELECT filename FROM schema_migrations ORDER BY filename ASC;';

const RECORD_MIGRATION_SQL =
  'INSERT INTO schema_migrations (filename) VALUES ($1);';

export async function runMigrations({
  client,
  migrationsDir,
  readdir: readDirectory = readdir,
  readFile: readMigrationFile = readFile
}) {
  const status = await getMigrationStatus({
    client,
    migrationsDir,
    readdir: readDirectory
  });
  const appliedMigrations = [];
  const skippedMigrations = [...status.appliedMigrations];

  for (const filename of status.pendingMigrations) {
    const sql = await readMigrationFile(path.join(migrationsDir, filename), 'utf8');
    await applyMigration({ client, filename, sql });
    appliedMigrations.push(filename);
  }

  return {
    appliedMigrations,
    skippedMigrations
  };
}

export async function getMigrationStatus({
  client,
  migrationsDir,
  readdir: readDirectory = readdir
}) {
  await client.query(CREATE_SCHEMA_MIGRATIONS_SQL);

  const allMigrations = (await readDirectory(migrationsDir))
    .filter((filename) => filename.endsWith('.sql'))
    .sort();

  const appliedRows = await client.query(LIST_APPLIED_MIGRATIONS_SQL);
  const applied = new Set(appliedRows.rows.map((row) => row.filename));

  return {
    allMigrations,
    appliedMigrations: allMigrations.filter((filename) => applied.has(filename)),
    pendingMigrations: allMigrations.filter((filename) => !applied.has(filename))
  };
}

async function applyMigration({ client, filename, sql }) {
  if (typeof client.connect !== 'function') {
    await client.query(sql);
    await client.query(RECORD_MIGRATION_SQL, [filename]);
    return;
  }

  const session = await client.connect();

  try {
    await session.query('BEGIN');
    await session.query(sql);
    await session.query(RECORD_MIGRATION_SQL, [filename]);
    await session.query('COMMIT');
  } catch (error) {
    await session.query('ROLLBACK');
    throw error;
  } finally {
    session.release?.();
  }
}
