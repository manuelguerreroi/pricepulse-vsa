import { Module } from '@nestjs/common';
import { UnsubscribeUserAlertEndpoint } from './unsubscribe-user-alert.endpoint';
import { UnsubscribeUserAlertHandler } from './unsubscribe-user-alert.handler';

@Module({
  controllers: [UnsubscribeUserAlertEndpoint],
  providers: [UnsubscribeUserAlertHandler],
  exports: [UnsubscribeUserAlertHandler],
})
export class UnsubscribeUserAlertModule {}
