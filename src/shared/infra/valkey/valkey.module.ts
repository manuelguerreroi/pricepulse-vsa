import { Module, Global, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';

export const VALKEY_CLIENT = Symbol('VALKEY_CLIENT');
export type ValkeyClient = Redis;

@Global()
@Module({
  providers: [
    {
      provide: VALKEY_CLIENT,
      useFactory: () => {
        const url = process.env.VALKEY_URL || 'redis://localhost:6379';
        return new Redis(url, { maxRetriesPerRequest: null });
      },
    },
  ],
  exports: [VALKEY_CLIENT],
})
export class ValkeyModule implements OnApplicationShutdown {
  constructor() {}

  async onApplicationShutdown() {
    // Graceful disconnect will be handled cleanly
  }
}
