const ep = require('embedded-postgres');
const EmbeddedPostgres = ep.default || ep;
const path = require('path');
const fs = require('fs');

async function run() {
  const dataDir = path.join(__dirname, '../.embedded-pg-data');
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'logistics',
    password: 'password',
    port: 5432,
    persistent: true,
  });

  const isInitialised = fs.existsSync(path.join(dataDir, 'PG_VERSION'));

  if (!isInitialised) {
    console.log('[PostgreSQL] Initialising cluster for the first time...');
    await pg.initialise();
  }

  console.log('[PostgreSQL] Starting database server on port 5432...');
  await pg.start();

  try {
    await pg.createDatabase('globallink');
    console.log('[PostgreSQL] Database "globallink" ready.');
  } catch (err) {
    // Already exists
  }

  console.log('[PostgreSQL] PostgreSQL is running at postgresql://logistics:password@localhost:5432/globallink');

  // Handle process shutdown
  process.on('SIGINT', async () => {
    console.log('\n[PostgreSQL] Stopping database server...');
    await pg.stop();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    console.log('\n[PostgreSQL] Stopping database server...');
    await pg.stop();
    process.exit(0);
  });

  // Keep process alive
  setInterval(() => {}, 1000 * 60 * 60);
}

run().catch((err) => {
  console.error('[PostgreSQL] Error:', err);
  process.exit(1);
});
