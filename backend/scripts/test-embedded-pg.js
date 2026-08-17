const ep = require('embedded-postgres');
const EmbeddedPostgres = ep.default || ep;
const path = require('path');

async function test() {
  console.log('Testing embedded-postgres initialization...');
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(__dirname, '../.embedded-pg-data'),
    user: 'logistics',
    password: 'password',
    port: 5432,
    persistent: true,
  });

  try {
    console.log('1. Initialising cluster...');
    await pg.initialise();
    console.log('2. Starting server...');
    await pg.start();
    console.log('3. Server started! Creating database globallink...');
    try {
      await pg.createDatabase('globallink');
      console.log('Database globallink created!');
    } catch (err) {
      console.log('Database might already exist:', err.message);
    }
    console.log('4. Testing connection...');
    const client = pg.getPgClient();
    await client.connect();
    const res = await client.query('SELECT NOW()');
    console.log('PostgreSQL connected successfully! Server time:', res.rows[0]);
    await client.end();
    console.log('Embedded postgres is working perfectly.');
  } catch (e) {
    console.error('Error with embedded-postgres:', e);
  }
}

test();
