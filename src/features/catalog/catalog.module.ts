import { Module } from '@nestjs/common';
import { RegisterTrackedUrlModule } from './register-tracked-url/register-tracked-url.module';

@Module({
  imports: [RegisterTrackedUrlModule],
  exports: [RegisterTrackedUrlModule],
})
export class CatalogModule {}
