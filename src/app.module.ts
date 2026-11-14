import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { HealthCheckModule } from './features/_template/health-check/health-check.module';
import { CatalogModule } from './features/catalog/catalog.module';
import { AlertsModule } from './features/alerts/alerts.module';
import { IngestionModule } from './features/ingestion/ingestion.module';
import { ScrapingModule } from './features/scraping/scraping.module';
import { NotificationsModule } from './features/notifications/notifications.module';

@Module({
  imports: [
    SharedModule,
    HealthCheckModule,
    CatalogModule,
    AlertsModule,
    IngestionModule,
    ScrapingModule,
    NotificationsModule,
  ],
})
export class AppModule {}
