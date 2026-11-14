import { Injectable, Inject, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { NatsConnection, JetStreamManager } from 'nats';
import { DRIZZLE_DB, DrizzleDb } from '@shared/infra/database/database.module';
import { VALKEY_CLIENT, ValkeyClient } from '@shared/infra/valkey/valkey.module';
import { NATS_CONNECTION, NATS_JSM } from '@shared/infra/nats/nats.module';
import { LivenessResponseDto, ReadinessResponseDto } from './health-check.dto';

@Injectable()
export class HealthCheckHandler {
  private readonly logger = new Logger(HealthCheckHandler.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    @Inject(VALKEY_CLIENT) private readonly valkey: ValkeyClient,
    @Inject(NATS_CONNECTION) private readonly natsConn: NatsConnection,
    @Inject(NATS_JSM) private readonly jsm: JetStreamManager,
  ) {}

  executeLiveness(): LivenessResponseDto {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  async executeReadiness(): Promise<ReadinessResponseDto> {
    const checks = {
      postgres: 'unhealthy' as 'ok' | 'unhealthy',
      valkey: 'unhealthy' as 'ok' | 'unhealthy',
      nats: 'unhealthy' as 'ok' | 'unhealthy',
    };

    // 1. Check PostgreSQL
    try {
      await this.db.execute(sql`SELECT 1`);
      checks.postgres = 'ok';
    } catch (error) {
      this.logger.error('PostgreSQL health check failed:', error);
    }

    // 2. Check Valkey
    try {
      const pong = await this.valkey.ping();
      if (pong === 'PONG') {
        checks.valkey = 'ok';
      }
    } catch (error) {
      this.logger.error('Valkey health check failed:', error);
    }

    // 3. Check NATS JetStream
    try {
      if (!this.natsConn.isClosed()) {
        await this.jsm.getAccountInfo();
        checks.nats = 'ok';
      }
    } catch (error) {
      this.logger.error('NATS JetStream health check failed:', error);
    }

    const isAllOk = checks.postgres === 'ok' && checks.valkey === 'ok' && checks.nats === 'ok';

    return {
      status: isAllOk ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
