import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sql, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { SharedModule } from '@shared/shared.module';
import { DRIZZLE_DB, DrizzleDb } from '@shared/infra/database/database.module';
import { trackedProducts, userAlerts } from '@shared/infra/database/schema';
import { AlertsModule } from '../alerts.module';

describe('Unsubscribe User Alert Slice (Integration Test)', () => {
  let app: INestApplication;
  let db: DrizzleDb;
  let sampleAlertId: string;

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
    await db.execute(sql`TRUNCATE TABLE price_snapshots, user_alerts, outbox_events, tracked_products CASCADE`);

    const [product] = await db
      .insert(trackedProducts)
      .values({
        url: 'https://mercadolibre.cl/p/MLC-UNSUB-TEST',
        domain: 'mercadolibre.cl',
        title: 'Cafetera Espresso Test',
        currentPriceMinorUnits: 80000,
        currency: 'CLP',
        status: 'ACTIVE',
      })
      .returning();

    const [alert] = await db
      .insert(userAlerts)
      .values({
        userEmail: 'unsub-user@gmail.com',
        productId: product.id,
        targetPriceMinorUnits: 70000,
        isActive: true,
      })
      .returning();

    sampleAlertId = alert.id;
  });

  it('GET /api/alerts/unsubscribe should deactivate active alert and return 200 OK', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/alerts/unsubscribe?alertId=${sampleAlertId}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('alertId', sampleAlertId);
    expect(response.body.message).toContain('successfully deactivated');

    // Verify in database
    const [alertInDb] = await db.select().from(userAlerts).where(eq(userAlerts.id, sampleAlertId));
    expect(alertInDb.isActive).toBe(false);
  });

  it('GET /api/alerts/unsubscribe should be idempotent if alert is already inactive', async () => {
    // First deactivation
    await request(app.getHttpServer())
      .get(`/api/alerts/unsubscribe?alertId=${sampleAlertId}`)
      .expect(200);

    // Second deactivation
    const response = await request(app.getHttpServer())
      .get(`/api/alerts/unsubscribe?alertId=${sampleAlertId}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toContain('already deactivated');
  });

  it('GET /api/alerts/unsubscribe should return 404 Not Found for non-existent alert ID', async () => {
    const nonExistentId = randomUUID();

    const response = await request(app.getHttpServer())
      .get(`/api/alerts/unsubscribe?alertId=${nonExistentId}`)
      .expect(404);

    expect(response.body).toHaveProperty('status', 404);
    expect(response.body).toHaveProperty('title', 'Not Found');
  });
});
