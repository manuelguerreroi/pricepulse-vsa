import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { sql, eq } from 'drizzle-orm';
import { Job } from 'bullmq';
import { SharedModule } from '@shared/shared.module';
import { DRIZZLE_DB, DrizzleDb } from '@shared/infra/database/database.module';
import { trackedProducts } from '@shared/infra/database/schema';
import { ScrapingModule } from '../scraping.module';
import { ScrapingSchedulerService } from './schedule-url-scrape.service';
import { ScrapeProductProcessor } from './schedule-url-scrape.processor';
import { ScrapeJobDataDto } from './schedule-url-scrape.dto';

describe('Schedule URL Scrape Slice (Integration Test)', () => {
  let app: INestApplication;
  let db: DrizzleDb;
  let scheduler: ScrapingSchedulerService;
  let processor: ScrapeProductProcessor;
  let sampleProductId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SharedModule, ScrapingModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    db = moduleFixture.get<DrizzleDb>(DRIZZLE_DB);
    scheduler = moduleFixture.get<ScrapingSchedulerService>(ScrapingSchedulerService);
    processor = moduleFixture.get<ScrapeProductProcessor>(ScrapeProductProcessor);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE price_snapshots, user_alerts, outbox_events, tracked_products CASCADE`);

    // Clean queue
    const queue = scheduler.getQueue();
    await queue.drain();

    const [product] = await db
      .insert(trackedProducts)
      .values({
        url: 'https://mercadolibre.cl/p/MLC-SCRAPE-TEST',
        domain: 'mercadolibre.cl',
        title: 'Teclado Mecánico RGB',
        currentPriceMinorUnits: 50000,
        currency: 'CLP',
        status: 'ACTIVE',
      })
      .returning();

    sampleProductId = product.id;
  });

  it('should successfully execute a scraping job and return new extracted price', async () => {
    const mockJob = {
      id: 'test-job-1',
      data: {
        productId: sampleProductId,
        url: 'https://mercadolibre.cl/p/MLC-SCRAPE-TEST?mock_price=45000',
        domain: 'mercadolibre.cl',
      },
    } as unknown as Job<ScrapeJobDataDto>;

    const result = await processor.processJob(mockJob);

    expect(result.success).toBe(true);
    expect(result.newPrice).toBe(45000);
  });

  it('should transition product to INACTIVE when product page returns 404/NOT_FOUND', async () => {
    const mockJob = {
      id: 'test-job-404',
      data: {
        productId: sampleProductId,
        url: 'https://mercadolibre.cl/p/404-not-found-item',
        domain: 'mercadolibre.cl',
      },
    } as unknown as Job<ScrapeJobDataDto>;

    const result = await processor.processJob(mockJob);

    expect(result.success).toBe(false);

    // Verify product status in PostgreSQL was updated to INACTIVE
    const [product] = await db.select().from(trackedProducts).where(eq(trackedProducts.id, sampleProductId));
    expect(product.status).toBe('INACTIVE');
  });

  it('should add repeatable scraping job to BullMQ queue', async () => {
    const job = await scheduler.scheduleRepeatableScrape(
      sampleProductId,
      'https://mercadolibre.cl/p/MLC-SCRAPE-TEST',
      'mercadolibre.cl',
      3600000, // 1 hour
    );

    expect(job).toBeDefined();
    expect(job.name).toBe('scrape-product');
    expect(job.data.productId).toBe(sampleProductId);
  });
});
