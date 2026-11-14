import { Module, Global } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE_DB = Symbol('DRIZZLE_DB');
export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DB,
      useFactory: () => {
        const connectionString =
          process.env.DATABASE_URL ||
          'postgres://pricepulse:pricepulse_secret@localhost:5432/pricepulse';
        const client = postgres(connectionString, { max: 10 });
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DRIZZLE_DB],
})
export class DatabaseModule {}
