import { Module, Global } from '@nestjs/common';
import { DatabaseModule } from './infra/database/database.module';
import { ValkeyModule } from './infra/valkey/valkey.module';
import { NatsModule } from './infra/nats/nats.module';
import { NatsBootstrapService } from './infra/nats/nats-bootstrap.service';

@Global()
@Module({
  imports: [DatabaseModule, ValkeyModule, NatsModule],
  providers: [NatsBootstrapService],
  exports: [DatabaseModule, ValkeyModule, NatsModule, NatsBootstrapService],
})
export class SharedModule {}
