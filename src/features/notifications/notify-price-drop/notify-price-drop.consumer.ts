import { Injectable, Inject, OnApplicationBootstrap, OnApplicationShutdown, Logger } from '@nestjs/common';
import { JetStreamClient, JetStreamManager, AckPolicy, StringCodec, ConsumerMessages } from 'nats';
import { NATS_JETSTREAM, NATS_JSM } from '@shared/infra/nats/nats.module';
import { NotifyPriceDropHandler, PriceDroppedEvent } from './notify-price-drop.handler';

const sc = StringCodec();
const CONSUMER_NAME = 'notifications-price-drop-v1';
const STREAM_NAME = 'PRICEPULSE';
const FILTER_SUBJECT = 'pricepulse.v1.events.price.dropped';

@Injectable()
export class NotifyPriceDropConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(NotifyPriceDropConsumer.name);
  private messagesSubscription: ConsumerMessages | null = null;
  private isRunning = false;

  constructor(
    @Inject(NATS_JETSTREAM) private readonly js: JetStreamClient,
    @Inject(NATS_JSM) private readonly jsm: JetStreamManager,
    private readonly handler: NotifyPriceDropHandler,
  ) {}

  async onApplicationBootstrap() {
    await this.startConsumer();
  }

  async onApplicationShutdown() {
    this.isRunning = false;
    if (this.messagesSubscription) {
      await this.messagesSubscription.close();
    }
  }

  async startConsumer(): Promise<void> {
    try {
      // 1. Ensure durable consumer exists on stream
      await this.jsm.consumers.add(STREAM_NAME, {
        durable_name: CONSUMER_NAME,
        ack_policy: AckPolicy.Explicit,
        ack_wait: 60 * 1000 * 1000 * 1000, // 60s in nanoseconds
        max_deliver: 5,
        filter_subject: FILTER_SUBJECT,
      });

      // 2. Obtain durable consumer handle
      const consumer = await this.js.consumers.get(STREAM_NAME, CONSUMER_NAME);
      this.messagesSubscription = await consumer.consume();
      this.isRunning = true;

      this.logger.log(`NATS durable consumer "${CONSUMER_NAME}" started on stream "${STREAM_NAME}".`);

      // 3. Process incoming messages asynchronously
      (async () => {
        try {
          for await (const msg of this.messagesSubscription!) {
            if (!this.isRunning) break;

            try {
              const rawData = sc.decode(msg.data);
              const event: PriceDroppedEvent = JSON.parse(rawData);

              await this.handler.handlePriceDropEvent(event);
              msg.ack();
            } catch (error) {
              this.logger.error(`Error processing message in ${CONSUMER_NAME}:`, error);
              msg.nak(); // Triggers retry with exponential backoff up to MaxDeliver
            }
          }
        } catch (err) {
          if (this.isRunning) {
            this.logger.error(`Consumer loop error in ${CONSUMER_NAME}:`, err);
          }
        }
      })();
    } catch (error) {
      this.logger.error(`Failed to initialize NATS consumer "${CONSUMER_NAME}":`, error);
    }
  }
}
