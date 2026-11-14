import { Injectable, Inject, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { JetStreamManager, RetentionPolicy, StorageType } from 'nats';
import { NATS_JSM } from './nats.module';

@Injectable()
export class NatsBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NatsBootstrapService.name);

  constructor(@Inject(NATS_JSM) private readonly jsm: JetStreamManager) {}

  async onApplicationBootstrap() {
    await this.ensureStreamExists();
  }

  async ensureStreamExists(streamName = 'PRICEPULSE'): Promise<void> {
    try {
      const streamInfo = await this.jsm.streams.info(streamName).catch(() => null);

      if (!streamInfo) {
        await this.jsm.streams.add({
          name: streamName,
          subjects: ['pricepulse.v1.events.>'],
          storage: StorageType.File,
          retention: RetentionPolicy.Limits,
          max_msgs: 100000,
        });
        this.logger.log(`NATS JetStream Stream "${streamName}" created successfully.`);
      } else {
        this.logger.log(`NATS JetStream Stream "${streamName}" is ready.`);
      }
    } catch (error) {
      this.logger.error(`Failed to ensure NATS stream "${streamName}":`, error);
      throw error;
    }
  }
}
