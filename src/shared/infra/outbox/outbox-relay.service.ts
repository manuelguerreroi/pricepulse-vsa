import { Injectable, Inject, Logger } from '@nestjs/common';
import { sql, eq } from 'drizzle-orm';
import { JetStreamClient, headers, StringCodec } from 'nats';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.module';
import { outboxEvents } from '../database/schema';
import { NATS_JETSTREAM } from '../nats/nats.module';

const sc = StringCodec();

const SUBJECT_MAP: Record<string, string> = {
  PriceDroppedEventV1: 'pricepulse.v1.events.price.dropped',
  ProductRegisteredEventV1: 'pricepulse.v1.events.catalog.product-registered',
};

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    @Inject(NATS_JETSTREAM) private readonly js: JetStreamClient,
  ) {}

  /**
   * Polls and publishes eligible pending outbox events using SKIP LOCKED for safe concurrent scaling.
   * Returns the count of successfully published events.
   */
  async processPendingEvents(batchSize = 50): Promise<number> {
    const pending = (await this.db.execute(sql`
      SELECT id, event_type as "eventType", payload, trace_id as "traceId", attempts, created_at as "createdAt"
      FROM outbox_events
      WHERE status = 'PENDING'
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    `)) as Array<{
      id: string;
      eventType: string;
      payload: unknown;
      traceId: string;
      attempts: number;
      createdAt: Date;
    }>;

    if (!pending || pending.length === 0) {
      return 0;
    }

    let publishedCount = 0;

    for (const event of pending) {
      const subject = SUBJECT_MAP[event.eventType];
      if (!subject) {
        this.logger.error(`Unknown event type in outbox: ${event.eventType}. Skipping.`);
        continue;
      }

      const h = headers();
      h.append('Nats-Msg-Id', event.id);
      h.append('traceparent', event.traceId);
      h.append('traceId', event.traceId);

      const envelope = JSON.stringify({
        id: event.id,
        eventType: event.eventType,
        traceId: event.traceId,
        occurredAt: event.createdAt,
        payload: event.payload,
      });

      try {
        await this.js.publish(subject, sc.encode(envelope), {
          headers: h,
          msgID: event.id,
        });

        // Mark as PUBLISHED
        await this.db
          .update(outboxEvents)
          .set({
            status: 'PUBLISHED',
            processedAt: sql`NOW()`,
            lastError: null,
          })
          .where(eq(outboxEvents.id, event.id));

        publishedCount++;
      } catch (error) {
        const attempts = (event.attempts || 0) + 1;
        const errorMessage = error instanceof Error ? error.message : String(error);

        this.logger.warn(`Failed to publish outbox event ${event.id} to ${subject} (attempt ${attempts}): ${errorMessage}`);

        if (attempts >= 5) {
          await this.db
            .update(outboxEvents)
            .set({
              status: 'FAILED',
              attempts,
              lastError: errorMessage,
            })
            .where(eq(outboxEvents.id, event.id));
        } else {
          const backoffMs = Math.pow(2, attempts) * 1000;
          await this.db
            .update(outboxEvents)
            .set({
              attempts,
              nextRetryAt: sql`NOW() + (${backoffMs} || ' milliseconds')::interval`,
              lastError: errorMessage,
            })
            .where(eq(outboxEvents.id, event.id));
        }
      }
    }

    return publishedCount;
  }
}
