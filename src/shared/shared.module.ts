import { Module, Global } from '@nestjs/common';
import { DatabaseModule } from './infra/database/database.module';
import { ValkeyModule } from './infra/valkey/valkey.module';
import { NatsModule } from './infra/nats/nats.module';
import { NatsBootstrapService } from './infra/nats/nats-bootstrap.service';
import { OutboxRelayService } from './infra/outbox/outbox-relay.service';
import { MailpitAdapter } from './infra/notifications/mailpit.adapter';
import { NOTIFICATION_PORT } from './ports/notification.port';

@Global()
@Module({
  imports: [DatabaseModule, ValkeyModule, NatsModule],
  providers: [
    NatsBootstrapService,
    OutboxRelayService,
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
    NOTIFICATION_PORT,
  ],
})
export class SharedModule {}
