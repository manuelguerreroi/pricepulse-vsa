import { Module } from '@nestjs/common';
import { CreateUserAlertModule } from './create-user-alert/create-user-alert.module';

@Module({
  imports: [CreateUserAlertModule],
  exports: [CreateUserAlertModule],
})
export class AlertsModule {}
