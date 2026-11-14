import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'env.example' });

export default defineConfig({
  schema: './src/shared/infra/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://pricepulse:pricepulse_secret@localhost:5432/pricepulse',
  },
  verbose: true,
  strict: true,
});
