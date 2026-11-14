import { Module } from '@nestjs/common';
import { CreateUserAlertModule } from './create-user-alert/create-user-alert.module';
import { UnsubscribeUserAlertModule } from './unsubscribe-user-alert/unsubscribe-user-alert.module';

@Module({
  imports: [CreateUserAlertModule, UnsubscribeUserAlertModule],
  exports: [CreateUserAlertModule, UnsubscribeUserAlertModule],
})
export class AlertsModule {}
