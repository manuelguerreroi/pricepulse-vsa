import { Module } from '@nestjs/common';
import { ScheduleUrlScrapeModule } from './schedule-url-scrape/schedule-url-scrape.module';

@Module({
  imports: [ScheduleUrlScrapeModule],
  exports: [ScheduleUrlScrapeModule],
})
export class ScrapingModule {}
