import { Module } from '@nestjs/common';
import { NotifyPriceDropModule } from './notify-price-drop/notify-price-drop.module';

@Module({
  imports: [NotifyPriceDropModule],
  exports: [NotifyPriceDropModule],
})
export class NotificationsModule {}
