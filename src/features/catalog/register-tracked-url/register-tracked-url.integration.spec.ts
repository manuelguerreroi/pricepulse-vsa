import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { SharedModule } from '@shared/shared.module';
import { DRIZZLE_DB, DrizzleDb } from '@shared/infra/database/database.module';
import { trackedProducts, priceSnapshots, outboxEvents } from '@shared/infra/database/schema';
import { CatalogModule } from '../catalog.module';

describe('Register Tracked URL Slice (Integration Test)', () => {
  let app: INestApplication;
  let db: DrizzleDb;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SharedModule, CatalogModule],
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
    // Clean tables between tests to ensure test isolation
    await db.execute(sql`TRUNCATE TABLE price_snapshots, user_alerts, outbox_events, tracked_products CASCADE`);
  });

  it('POST /api/catalog/products should register a product, create snapshot, and insert Outbox event in a single transaction', async () => {
    const rawUrl = 'https://mercadolibre.cl/p/MLC10001?utm_source=newsletter&utm_medium=email#details';

    const response = await request(app.getHttpServer())
      .post('/api/catalog/products')
      .send({ url: rawUrl })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.url).toBe('https://mercadolibre.cl/p/MLC10001'); // Normalized
    expect(response.body.domain).toBe('mercadolibre.cl');
    expect(response.body.status).toBe('ACTIVE');
    expect(response.body.currentPriceMinorUnits).toBe(15000);
    expect(response.body.currency).toBe('CLP');

    const productId = response.body.id;

    // 1. Verify tracked_products in PostgreSQL
    const productsInDb = await db.select().from(trackedProducts);
    expect(productsInDb.length).toBe(1);
    expect(productsInDb[0].id).toBe(productId);

    // 2. Verify price_snapshots in PostgreSQL
    const snapshotsInDb = await db.select().from(priceSnapshots);
    expect(snapshotsInDb.length).toBe(1);
    expect(snapshotsInDb[0].productId).toBe(productId);
    expect(snapshotsInDb[0].priceMinorUnits).toBe(15000);

    // 3. Verify outbox_events in PostgreSQL
    const outboxInDb = await db.select().from(outboxEvents);
    expect(outboxInDb.length).toBe(1);
    expect(outboxInDb[0].eventType).toBe('ProductRegisteredEventV1');
    expect(outboxInDb[0].status).toBe('PENDING');
    expect(outboxInDb[0].payload).toMatchObject({
      productId,
      url: 'https://mercadolibre.cl/p/MLC10001',
      domain: 'mercadolibre.cl',
      initialPriceMinorUnits: 15000,
      currency: 'CLP',
    });
  });

  it('POST /api/catalog/products should return 409 Conflict when URL is already registered (even with different UTM params)', async () => {
    const url1 = 'https://mercadolibre.cl/p/MLC10001?utm_source=facebook';
    const url2 = 'https://mercadolibre.cl/p/MLC10001?utm_source=google&gclid=xyz';

    // First registration
    await request(app.getHttpServer())
      .post('/api/catalog/products')
      .send({ url: url1 })
      .expect(201);

    // Duplicate registration (normalized to same URL)
    const response = await request(app.getHttpServer())
      .post('/api/catalog/products')
      .send({ url: url2 })
      .expect(409);

    expect(response.body).toHaveProperty('status', 409);
    expect(response.body).toHaveProperty('title', 'Conflict');
  });

  it('POST /api/catalog/products should return 400 Bad Request when Anti-SSRF triggers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/catalog/products')
      .send({ url: 'http://169.254.169.254/latest/meta-data/' })
      .expect(400);

    expect(response.body).toHaveProperty('status', 400);
    expect(response.body).toHaveProperty('title', 'Bad Request');
  });

  it('POST /api/catalog/products should return 502 Bad Gateway when scraping fails', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/catalog/products')
      .send({ url: 'https://mercadolibre.cl/p/404-not-found-item' })
      .expect(502);

    expect(response.body).toHaveProperty('status', 502);
    expect(response.body).toHaveProperty('title', 'Bad Gateway');
  });
});
