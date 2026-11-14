import { Module } from '@nestjs/common';
import { HealthCheckEndpoint } from './health-check.endpoint';
import { HealthCheckHandler } from './health-check.handler';

@Module({
  controllers: [HealthCheckEndpoint],
  providers: [HealthCheckHandler],
  exports: [HealthCheckHandler],
})
export class HealthCheckModule {}
