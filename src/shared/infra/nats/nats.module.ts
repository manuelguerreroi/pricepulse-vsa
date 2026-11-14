import { Module, Global, OnApplicationBootstrap, OnApplicationShutdown, Logger } from '@nestjs/common';
import { connect, NatsConnection, JetStreamClient, JetStreamManager, RetentionPolicy, StorageType } from 'nats';

export const NATS_CONNECTION = Symbol('NATS_CONNECTION');
export const NATS_JETSTREAM = Symbol('NATS_JETSTREAM');
export const NATS_JSM = Symbol('NATS_JSM');

@Global()
@Module({
  providers: [
    {
      provide: NATS_CONNECTION,
      useFactory: async () => {
        const servers = process.env.NATS_URL || 'nats://localhost:4222';
        return await connect({ servers });
      },
    },
    {
      provide: NATS_JETSTREAM,
      useFactory: (nc: NatsConnection) => {
        return nc.jetstream();
      },
      inject: [NATS_CONNECTION],
    },
    {
      provide: NATS_JSM,
      useFactory: async (nc: NatsConnection) => {
        return await nc.jetstreamManager();
      },
      inject: [NATS_CONNECTION],
    },
  ],
  exports: [NATS_CONNECTION, NATS_JETSTREAM, NATS_JSM],
})
export class NatsModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(NatsModule.name);

  constructor() {}

  async onApplicationBootstrap() {
    // Stream bootstrap will be handled by NatsBootstrapService
  }

  async onApplicationShutdown() {
    // Handled in graceful shutdown
  }
}
