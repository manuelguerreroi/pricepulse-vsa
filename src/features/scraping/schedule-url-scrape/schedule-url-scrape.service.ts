import { Injectable, Inject, OnApplicationShutdown, Logger } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { VALKEY_CLIENT, ValkeyClient } from '@shared/infra/valkey/valkey.module';
import { ScrapeJobDataDto } from './schedule-url-scrape.dto';
import { SCRAPING_QUEUE_NAME } from './schedule-url-scrape.processor';

@Injectable()
export class ScrapingSchedulerService implements OnApplicationShutdown {
  private readonly logger = new Logger(ScrapingSchedulerService.name);
  private queue: Queue<ScrapeJobDataDto>;

  constructor(@Inject(VALKEY_CLIENT) private readonly valkey: ValkeyClient) {
    this.queue = new Queue<ScrapeJobDataDto>(SCRAPING_QUEUE_NAME, {
      connection: this.valkey,
    });
  }

  async onApplicationShutdown() {
    await this.queue.close();
  }

  /**
   * Schedules a distributed repeatable scrape job (e.g. every 4 hours).
   */
  async scheduleRepeatableScrape(
    productId: string,
    url: string,
    domain: string,
    intervalMs = 14400000, // 4 hours
  ): Promise<Job<ScrapeJobDataDto>> {
    const job = await this.queue.add(
      'scrape-product',
      { productId, url, domain },
      {
        jobId: `repeat-${productId}`,
        repeat: { every: intervalMs },
        removeOnComplete: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    this.logger.log(`Scheduled repeatable scraping for product ${productId} every ${intervalMs}ms`);
    return job;
  }

  /**
   * Enqueues an immediate one-off scraping job.
   */
  async addImmediateScrapeJob(productId: string, url: string, domain: string): Promise<Job<ScrapeJobDataDto>> {
    return await this.queue.add(
      'scrape-product-immediate',
      { productId, url, domain },
      {
        removeOnComplete: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
      },
    );
  }

  getQueue(): Queue<ScrapeJobDataDto> {
    return this.queue;
  }
}
