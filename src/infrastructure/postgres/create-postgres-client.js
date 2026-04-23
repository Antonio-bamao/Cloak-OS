import pg from 'pg';

const { Pool } = pg;

export function createPostgresClientFactory({ Pool: PoolClass = Pool } = {}) {
  return async function createPostgresClient(databaseUrl) {
    const pool = new PoolClass({
      connectionString: databaseUrl
    });

    await pool.query('SELECT 1');

    return pool;
  };
}
