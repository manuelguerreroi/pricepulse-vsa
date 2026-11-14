import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';

export async function setup() {
  dotenv.config({ path: 'env.example' });

  const connectionString =
    process.env.DATABASE_URL ||
    'postgres://pricepulse:pricepulse_secret@localhost:5432/pricepulse';

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  const migrationsFolder = path.resolve(__dirname, '../drizzle');

  try {
    console.log(`\n[GlobalSetup] Applying Drizzle migrations from ${migrationsFolder}...`);
    await migrate(db, { migrationsFolder });
    console.log('[GlobalSetup] Migrations applied successfully.\n');
  } catch (error) {
    console.error('[GlobalSetup] Error applying migrations:', error);
    throw error;
  } finally {
    await client.end();
  }
}
