import { Injectable, Inject, OnApplicationBootstrap, OnApplicationShutdown, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { VALKEY_CLIENT, ValkeyClient } from '@shared/infra/valkey/valkey.module';
import { DRIZZLE_DB, DrizzleDb } from '@shared/infra/database/database.module';
import { trackedProducts } from '@shared/infra/database/schema';
import { SCRAPER_PORT, ScraperPort } from '@shared/ports/scraper.port';
import { ScrapeJobDataDto } from './schedule-url-scrape.dto';

export const SCRAPING_QUEUE_NAME = 'scraping-queue';

@Injectable()
export class ScrapeProductProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ScrapeProductProcessor.name);
  private worker: Worker | null = null;

  constructor(
    @Inject(VALKEY_CLIENT) private readonly valkey: ValkeyClient,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    @Inject(SCRAPER_PORT) private readonly scraper: ScraperPort,
  ) {}

  onApplicationBootstrap() {
    this.startWorker();
  }

  async onApplicationShutdown() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('Scraping BullMQ worker closed.');
    }
  }

  startWorker(): void {
    this.worker = new Worker<ScrapeJobDataDto>(
      SCRAPING_QUEUE_NAME,
      async (job: Job<ScrapeJobDataDto>) => {
        return await this.processJob(job);
      },
      {
        connection: this.valkey,
        concurrency: 2,
        limiter: {
          max: 2,
          duration: 1000, // Max 2 requests per second across jobs
        },
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Scraping job ${job.id} for product ${job.data.productId} completed.`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Scraping job ${job?.id} failed: ${err.message}`);
    });
  }

  async processJob(job: Job<ScrapeJobDataDto>): Promise<{ success: boolean; newPrice?: number; error?: string }> {
    const { productId, url } = job.data;
    this.logger.log(`Processing scraping job for product ${productId} (${url})`);

    // 1. Scrape product page
    const scrapeResult = await this.scraper.scrape(url);

    if (scrapeResult.isErr()) {
      const err = scrapeResult.error;

      // If product page is dead (404/NOT_FOUND), update status to INACTIVE
      if (err.code === 'NOT_FOUND') {
        this.logger.warn(`Product ${productId} returned 404/NOT_FOUND. Updating status to INACTIVE.`);
        await this.db
          .update(trackedProducts)
          .set({ status: 'INACTIVE' })
          .where(eq(trackedProducts.id, productId));
        return { success: false, error: 'Product page removed (INACTIVE)' };
      }

      // For transient errors (BLOCKED, UNREACHABLE), throw error to let BullMQ retry with backoff
      throw new Error(`Scraping attempt failed with code "${err.code}": ${err.message}`);
    }

    const { priceMinorUnits } = scrapeResult.value;

    // 2. Dispatch to Ingestion API
    const ingestionUrl = process.env.INGESTION_API_URL || 'http://127.0.0.1:3333/api/ingestion/snapshots';

    try {
      const response = await fetch(ingestionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          newPriceMinorUnits: priceMinorUnits,
        }),
      });

      if (!response.ok) {
        this.logger.warn(`Ingestion API responded with status ${response.status} for product ${productId}`);
      }
    } catch (error) {
      this.logger.warn(`Could not reach Ingestion API directly from worker: ${error}`);
    }

    return {
      success: true,
      newPrice: priceMinorUnits,
    };
  }
}
