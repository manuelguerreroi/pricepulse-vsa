import { Module } from '@nestjs/common';
import { NotifyPriceDropHandler } from './notify-price-drop.handler';
import { NotifyPriceDropConsumer } from './notify-price-drop.consumer';

@Module({
  providers: [NotifyPriceDropHandler, NotifyPriceDropConsumer],
  exports: [NotifyPriceDropHandler],
})
export class NotifyPriceDropModule {}
