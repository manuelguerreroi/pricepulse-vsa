import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Result } from '@shared/domain/result';
import { DRIZZLE_DB, DrizzleDb } from '@shared/infra/database/database.module';
import { userAlerts } from '@shared/infra/database/schema';
import { UnsubscribeResponseDto } from './unsubscribe-user-alert.dto';

export class AlertNotFoundError extends Error {
  constructor(alertId: string) {
    super(`Alert with ID "${alertId}" was not found`);
    this.name = 'AlertNotFoundError';
  }
}

export type UnsubscribeError = AlertNotFoundError;

@Injectable()
export class UnsubscribeUserAlertHandler {
  private readonly logger = new Logger(UnsubscribeUserAlertHandler.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async execute(alertId: string): Promise<Result<UnsubscribeResponseDto, UnsubscribeError>> {
    // 1. Find alert
    const [alert] = await this.db
      .select()
      .from(userAlerts)
      .where(eq(userAlerts.id, alertId))
      .limit(1);

    if (!alert) {
      return Result.err(new AlertNotFoundError(alertId));
    }

    // 2. If already inactive, return idempotent success
    if (!alert.isActive) {
      this.logger.log(`Alert ${alertId} was already inactive.`);
      return Result.ok({
        success: true,
        alertId: alert.id,
        message: 'This alert was already deactivated.',
      });
    }

    // 3. Deactivate alert
    await this.db
      .update(userAlerts)
      .set({ isActive: false })
      .where(eq(userAlerts.id, alert.id));

    this.logger.log(`Alert ${alertId} for ${alert.userEmail} has been deactivated.`);

    return Result.ok({
      success: true,
      alertId: alert.id,
      message: 'Alert successfully deactivated. You will no longer receive emails for this product.',
    });
  }
}
