import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SharedModule } from '@shared/shared.module';
import { HealthCheckModule } from './health-check.module';

describe('HealthCheck Slice (Golden Slice Integration Test)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SharedModule, HealthCheckModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /health/liveness should return 200 with status alive', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/liveness')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'alive');
    expect(response.body).toHaveProperty('timestamp');
  });

  it('GET /health/readiness should verify real Postgres, Valkey, and NATS connections', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/readiness')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'ready');
    expect(response.body).toHaveProperty('checks');
    expect(response.body.checks).toEqual({
      postgres: 'ok',
      valkey: 'ok',
      nats: 'ok',
    });
  });
});
