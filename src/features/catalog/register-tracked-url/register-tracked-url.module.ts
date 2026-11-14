import { Module } from '@nestjs/common';
import { RegisterTrackedUrlEndpoint } from './register-tracked-url.endpoint';
import { RegisterTrackedUrlHandler } from './register-tracked-url.handler';
import { SCRAPER_PORT } from '@shared/ports/scraper.port';
import { MockE2EShopAdapter } from '@shared/infra/scraper/mock-e2e-shop.adapter';

@Module({
  controllers: [RegisterTrackedUrlEndpoint],
  providers: [
    RegisterTrackedUrlHandler,
    {
      provide: SCRAPER_PORT,
      useClass: MockE2EShopAdapter,
    },
  ],
  exports: [RegisterTrackedUrlHandler],
})
export class RegisterTrackedUrlModule {}
