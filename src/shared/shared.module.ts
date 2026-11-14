import { Module, Global } from '@nestjs/common';
import { DatabaseModule } from './infra/database/database.module';
import { ValkeyModule } from './infra/valkey/valkey.module';
import { NatsModule } from './infra/nats/nats.module';
import { NatsBootstrapService } from './infra/nats/nats-bootstrap.service';
import { OutboxRelayService } from './infra/outbox/outbox-relay.service';
import { MailpitAdapter } from './infra/notifications/mailpit.adapter';
import { NOTIFICATION_PORT } from './ports/notification.port';
import { MetricsService } from './infra/observability/metrics.service';
import { MetricsController } from './infra/observability/metrics.controller';

@Global()
@Module({
  imports: [DatabaseModule, ValkeyModule, NatsModule],
  controllers: [MetricsController],
  providers: [
    NatsBootstrapService,
    OutboxRelayService,
    MetricsService,
    {
      provide: NOTIFICATION_PORT,
      useClass: MailpitAdapter,
    },
  ],
  exports: [
    DatabaseModule,
    ValkeyModule,
    NatsModule,
    NatsBootstrapService,
    OutboxRelayService,
    MetricsService,
    NOTIFICATION_PORT,
  ],
})
export class SharedModule {}
