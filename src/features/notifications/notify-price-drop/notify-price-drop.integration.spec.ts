import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { sql, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { SharedModule } from '@shared/shared.module';
import { DRIZZLE_DB, DrizzleDb } from '@shared/infra/database/database.module';
import { trackedProducts, userAlerts, processedEvents, outboxEvents } from '@shared/infra/database/schema';
import { OutboxRelayService } from '@shared/infra/outbox/outbox-relay.service';
import { NotificationsModule } from '../notifications.module';
import { NotifyPriceDropHandler, PriceDroppedEvent } from './notify-price-drop.handler';

describe('Notify Price Drop Consumer Slice (Integration Test)', () => {
  let app: INestApplication;
  let db: DrizzleDb;
  let handler: NotifyPriceDropHandler;
  let outboxRelay: OutboxRelayService;
  let sampleProductId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SharedModule, NotificationsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    db = moduleFixture.get<DrizzleDb>(DRIZZLE_DB);
    handler = moduleFixture.get<NotifyPriceDropHandler>(NotifyPriceDropHandler);
    outboxRelay = moduleFixture.get<OutboxRelayService>(OutboxRelayService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Clean tables to ensure complete isolation
    await db.execute(sql`TRUNCATE TABLE price_snapshots, user_alerts, outbox_events, processed_events, tracked_products CASCADE`);

    // Create a base tracked product
    const [product] = await db
      .insert(trackedProducts)
      .values({
        url: 'https://mercadolibre.cl/p/MLC-NOTIF-TEST',
        domain: 'mercadolibre.cl',
        title: 'Auriculares Inalámbricos Pro',
        currentPriceMinorUnits: 100000,
        currency: 'CLP',
        status: 'ACTIVE',
      })
      .returning();

    sampleProductId = product.id;

    // Create an active user alert
    await db.insert(userAlerts).values({
      userEmail: 'comprador@gmail.com',
      productId: sampleProductId,
      targetPriceMinorUnits: 85000,
      isActive: true,
    });
  });

  it('should process PriceDroppedEvent, send email to matching alerts, and record idempotency', async () => {
    const eventId = randomUUID();
    const event: PriceDroppedEvent = {
      id: eventId,
      eventType: 'PriceDroppedEventV1',
      traceId: randomUUID(),
      occurredAt: new Date().toISOString(),
      payload: {
        productId: sampleProductId,
        oldPriceMinorUnits: 100000,
        newPriceMinorUnits: 75000, // Meets the 85.000 target threshold
        dropPercentage: 25,
        currency: 'CLP',
        snapshotId: randomUUID(),
      },
    };

    const result = await handler.handlePriceDropEvent(event);

    expect(result.duplicatesSkipped).toBe(false);
    expect(result.alertsEvaluated).toBe(1);
    expect(result.emailsSent).toBe(1);

    // 1. Verify idempotency in processed_events table
    const processed = await db.select().from(processedEvents).where(eq(processedEvents.eventId, eventId));
    expect(processed.length).toBe(1);
    expect(processed[0].consumerName).toBe('notifications-price-drop-v1');

    // 2. Verify alert record was updated with last_notified_at
    const [updatedAlert] = await db.select().from(userAlerts);
    expect(updatedAlert.lastNotifiedAt).not.toBeNull();
    expect(updatedAlert.lastNotifiedPriceMinorUnits).toBe(75000);
  });

  it('should deduplicate and skip processing when exact same event is delivered twice', async () => {
    const eventId = randomUUID();
    const event: PriceDroppedEvent = {
      id: eventId,
      eventType: 'PriceDroppedEventV1',
      traceId: randomUUID(),
      occurredAt: new Date().toISOString(),
      payload: {
        productId: sampleProductId,
        oldPriceMinorUnits: 100000,
        newPriceMinorUnits: 75000,
        dropPercentage: 25,
        currency: 'CLP',
        snapshotId: randomUUID(),
      },
    };

    // First delivery
    const firstResult = await handler.handlePriceDropEvent(event);
    expect(firstResult.duplicatesSkipped).toBe(false);
    expect(firstResult.emailsSent).toBe(1);

    // Duplicate delivery
    const secondResult = await handler.handlePriceDropEvent(event);
    expect(secondResult.duplicatesSkipped).toBe(true);
    expect(secondResult.emailsSent).toBe(0); // ZERO duplicate emails!
  });

  it('should suppress notification if 24h cooldown is active and price did not drop further', async () => {
    // 1. First event
    const event1: PriceDroppedEvent = {
      id: randomUUID(),
      eventType: 'PriceDroppedEventV1',
      traceId: randomUUID(),
      occurredAt: new Date().toISOString(),
      payload: {
        productId: sampleProductId,
        oldPriceMinorUnits: 100000,
        newPriceMinorUnits: 80000,
        dropPercentage: 20,
        currency: 'CLP',
        snapshotId: randomUUID(),
      },
    };
    await handler.handlePriceDropEvent(event1);

    // 2. Second event within 24h at same price (80.000)
    const event2: PriceDroppedEvent = {
      id: randomUUID(),
      eventType: 'PriceDroppedEventV1',
      traceId: randomUUID(),
      occurredAt: new Date().toISOString(),
      payload: {
        productId: sampleProductId,
        oldPriceMinorUnits: 80000,
        newPriceMinorUnits: 80000,
        dropPercentage: 0,
        currency: 'CLP',
        snapshotId: randomUUID(),
      },
    };

    const secondResult = await handler.handlePriceDropEvent(event2);
    expect(secondResult.duplicatesSkipped).toBe(false);
    expect(secondResult.emailsSent).toBe(0); // Suppressed by cooldown!
  });

  it('OutboxRelayService should publish pending events to NATS JetStream and mark them as PUBLISHED', async () => {
    const eventId = randomUUID();
    const traceId = randomUUID();

    // 1. Insert pending event into outbox_events
    await db.insert(outboxEvents).values({
      id: eventId,
      eventType: 'PriceDroppedEventV1',
      payload: {
        productId: sampleProductId,
        oldPriceMinorUnits: 100000,
        newPriceMinorUnits: 70000,
        dropPercentage: 30,
        currency: 'CLP',
        snapshotId: randomUUID(),
      },
      traceId,
      status: 'PENDING',
    });

    // 2. Run Outbox Relay
    const publishedCount = await outboxRelay.processPendingEvents();
    expect(publishedCount).toBeGreaterThanOrEqual(1);

    // 3. Verify event is now PUBLISHED in database
    const [eventInDb] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, eventId));
    expect(eventInDb.status).toBe('PUBLISHED');
    expect(eventInDb.processedAt).not.toBeNull();
  });
});
