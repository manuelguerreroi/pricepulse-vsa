import { Module } from '@nestjs/common';
import { CreateUserAlertEndpoint } from './create-user-alert.endpoint';
import { CreateUserAlertHandler } from './create-user-alert.handler';

@Module({
  controllers: [CreateUserAlertEndpoint],
  providers: [CreateUserAlertHandler],
  exports: [CreateUserAlertHandler],
})
export class CreateUserAlertModule {}
