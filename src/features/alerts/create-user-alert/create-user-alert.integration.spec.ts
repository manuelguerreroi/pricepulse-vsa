import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { SharedModule } from '@shared/shared.module';
import { DRIZZLE_DB, DrizzleDb } from '@shared/infra/database/database.module';
import { trackedProducts, userAlerts } from '@shared/infra/database/schema';
import { AlertsModule } from '../alerts.module';

describe('Create User Alert Slice (Integration Test)', () => {
  let app: INestApplication;
  let db: DrizzleDb;
  let sampleProductId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SharedModule, AlertsModule],
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

    // Create a base tracked product for testing alerts
    const [product] = await db
      .insert(trackedProducts)
      .values({
        url: 'https://mercadolibre.cl/p/MLC-ALERT-TEST',
        domain: 'mercadolibre.cl',
        title: 'Smartphone Test Product',
        currentPriceMinorUnits: 100000, // 100.000 CLP
        currency: 'CLP',
        status: 'ACTIVE',
      })
      .returning();

    sampleProductId = product.id;
  });

  it('POST /api/alerts should create an active alert when target price is lower than current price', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/alerts')
      .send({
        userEmail: 'comprador@gmail.com',
        productId: sampleProductId,
        targetPriceMinorUnits: 80000, // Lower than 100.000 CLP
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.userEmail).toBe('comprador@gmail.com');
    expect(response.body.productId).toBe(sampleProductId);
    expect(response.body.targetPriceMinorUnits).toBe(80000);
    expect(response.body.isActive).toBe(true);

    // Verify in database
    const alertsInDb = await db.select().from(userAlerts);
    expect(alertsInDb.length).toBe(1);
    expect(alertsInDb[0].userEmail).toBe('comprador@gmail.com');
    expect(alertsInDb[0].targetPriceMinorUnits).toBe(80000);
  });

  it('POST /api/alerts should return 409 Conflict if active alert already exists for user and product', async () => {
    // First alert
    await request(app.getHttpServer())
      .post('/api/alerts')
      .send({
        userEmail: 'comprador@gmail.com',
        productId: sampleProductId,
        targetPriceMinorUnits: 85000,
      })
      .expect(201);

    // Duplicate alert
    const response = await request(app.getHttpServer())
      .post('/api/alerts')
      .send({
        userEmail: 'comprador@gmail.com',
        productId: sampleProductId,
        targetPriceMinorUnits: 75000,
      })
      .expect(409);

    expect(response.body).toHaveProperty('status', 409);
    expect(response.body).toHaveProperty('title', 'Conflict');
  });

  it('POST /api/alerts should return 404 Not Found if product does not exist', async () => {
    const nonExistentId = randomUUID();

    const response = await request(app.getHttpServer())
      .post('/api/alerts')
      .send({
        userEmail: 'user@gmail.com',
        productId: nonExistentId,
        targetPriceMinorUnits: 50000,
      })
      .expect(404);

    expect(response.body).toHaveProperty('status', 404);
    expect(response.body).toHaveProperty('title', 'Not Found');
  });

  it('POST /api/alerts should return 400 Bad Request if target price is greater or equal to current price', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/alerts')
      .send({
        userEmail: 'user@gmail.com',
        productId: sampleProductId,
        targetPriceMinorUnits: 120000, // Higher than 100.000 current price
      })
      .expect(400);

    expect(response.body).toHaveProperty('status', 400);
    expect(response.body).toHaveProperty('title', 'Bad Request');
  });
});
