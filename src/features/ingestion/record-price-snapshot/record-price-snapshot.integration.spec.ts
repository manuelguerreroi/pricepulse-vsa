import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sql, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { SharedModule } from '@shared/shared.module';
import { DRIZZLE_DB, DrizzleDb } from '@shared/infra/database/database.module';
import { trackedProducts, priceSnapshots, outboxEvents } from '@shared/infra/database/schema';
import { IngestionModule } from '../ingestion.module';

describe('Record Price Snapshot Slice (Integration Test)', () => {
  let app: INestApplication;
  let db: DrizzleDb;
  let sampleProductId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SharedModule, IngestionModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    db = moduleFixture.get<DrizzleDb>(DRIZZLE_DB);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Clean tables to ensure test isolation
    await db.execute(sql`TRUNCATE TABLE price_snapshots, user_alerts, outbox_events, tracked_products CASCADE`);

    // Create a base tracked product for testing price snapshots
    const [product] = await db
      .insert(trackedProducts)
      .values({
        url: 'https://mercadolibre.cl/p/MLC-INGESTION-TEST',
        domain: 'mercadolibre.cl',
        title: 'Monitor 4K Test Product',
        currentPriceMinorUnits: 100000, // 100.000 CLP
        currency: 'CLP',
        status: 'ACTIVE',
      })
      .returning();

    sampleProductId = product.id;
  });

  it('POST /api/ingestion/snapshots should detect price drop, update product, and emit PriceDroppedEventV1 to Outbox', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/ingestion/snapshots')
      .send({
        productId: sampleProductId,
        newPriceMinorUnits: 75000, // 25% drop (100.000 -> 75.000)
      })
      .expect(201);

    expect(response.body.isPriceDrop).toBe(true);
    expect(response.body.dropPercentage).toBe(25);
    expect(response.body.oldPriceMinorUnits).toBe(100000);
    expect(response.body.newPriceMinorUnits).toBe(75000);

    // 1. Verify tracked_products was updated
    const [updatedProduct] = await db
      .select()
      .from(trackedProducts)
      .where(eq(trackedProducts.id, sampleProductId));
    expect(updatedProduct.currentPriceMinorUnits).toBe(75000);

    // 2. Verify price_snapshots has the new record
    const snapshotsInDb = await db.select().from(priceSnapshots);
    expect(snapshotsInDb.length).toBe(1);
    expect(snapshotsInDb[0].priceMinorUnits).toBe(75000);

    // 3. Verify outbox_events has PriceDroppedEventV1
    const outboxInDb = await db.select().from(outboxEvents);
    expect(outboxInDb.length).toBe(1);
    expect(outboxInDb[0].eventType).toBe('PriceDroppedEventV1');
    expect(outboxInDb[0].status).toBe('PENDING');
    expect(outboxInDb[0].payload).toMatchObject({
      productId: sampleProductId,
      oldPriceMinorUnits: 100000,
      newPriceMinorUnits: 75000,
      dropPercentage: 25,
      currency: 'CLP',
    });
  });

  it('POST /api/ingestion/snapshots should update product when price increases, but NOT emit drop event to Outbox', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/ingestion/snapshots')
      .send({
        productId: sampleProductId,
        newPriceMinorUnits: 120000, // Price increase (100.000 -> 120.000)
      })
      .expect(201);

    expect(response.body.isPriceDrop).toBe(false);
    expect(response.body.dropPercentage).toBe(0);
    expect(response.body.newPriceMinorUnits).toBe(120000);

    // 1. Verify tracked_products was updated to 120.000
    const [updatedProduct] = await db
      .select()
      .from(trackedProducts)
      .where(eq(trackedProducts.id, sampleProductId));
    expect(updatedProduct.currentPriceMinorUnits).toBe(120000);

    // 2. Verify NO Outbox event was emitted
    const outboxInDb = await db.select().from(outboxEvents);
    expect(outboxInDb.length).toBe(0);
  });

  it('POST /api/ingestion/snapshots should return 404 Not Found if product does not exist', async () => {
    const nonExistentId = randomUUID();

    const response = await request(app.getHttpServer())
      .post('/api/ingestion/snapshots')
      .send({
        productId: nonExistentId,
        newPriceMinorUnits: 50000,
      })
      .expect(404);

    expect(response.body).toHaveProperty('status', 404);
    expect(response.body).toHaveProperty('title', 'Not Found');
  });

  it('POST /api/ingestion/snapshots should return 400 Bad Request if price is zero or negative', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/ingestion/snapshots')
      .send({
        productId: sampleProductId,
        newPriceMinorUnits: -100,
      })
      .expect(400);

    expect(response.body).toHaveProperty('status', 400);
  });
});
