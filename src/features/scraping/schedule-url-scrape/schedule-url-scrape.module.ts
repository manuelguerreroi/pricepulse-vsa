import { Module } from '@nestjs/common';
import { ScrapeProductProcessor } from './schedule-url-scrape.processor';
import { ScrapingSchedulerService } from './schedule-url-scrape.service';
import { SCRAPER_PORT } from '@shared/ports/scraper.port';
import { MockE2EShopAdapter } from '@shared/infra/scraper/mock-e2e-shop.adapter';

@Module({
  providers: [
    ScrapeProductProcessor,
    ScrapingSchedulerService,
    {
      provide: SCRAPER_PORT,
      useClass: MockE2EShopAdapter,
    },
  ],
  exports: [ScrapingSchedulerService, ScrapeProductProcessor],
})
export class ScheduleUrlScrapeModule {}
