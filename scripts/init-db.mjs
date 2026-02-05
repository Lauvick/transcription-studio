import { config } from 'dotenv';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

config({ path: '.env.local' });

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const sql = fs.readFileSync(path.resolve(process.cwd(), 'init.sql'), 'utf8');
  console.log('Initializing database...');
  await db.query(sql);
  console.log('Database initialized.');
  await db.end();
}

main();
