import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDb } from '@shared/infra/database/database.module';
import { trackedProducts, userAlerts, processedEvents } from '@shared/infra/database/schema';
import { NOTIFICATION_PORT, NotificationPort, PriceDropAlertEmailData } from '@shared/ports/notification.port';

export interface PriceDroppedEventPayload {
  productId: string;
  oldPriceMinorUnits: number;
  newPriceMinorUnits: number;
  dropPercentage: number;
  currency: string;
  snapshotId: string;
}

export interface PriceDroppedEvent {
  id: string;
  eventType: string;
  traceId: string;
  occurredAt: string;
  payload: PriceDroppedEventPayload;
}

export interface PriceDropHandlingResult {
  alertsEvaluated: number;
  emailsSent: number;
  duplicatesSkipped: boolean;
}

const CONSUMER_NAME = 'notifications-price-drop-v1';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class NotifyPriceDropHandler {
  private readonly logger = new Logger(NotifyPriceDropHandler.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    @Inject(NOTIFICATION_PORT) private readonly notifier: NotificationPort,
  ) {}

  async handlePriceDropEvent(event: PriceDroppedEvent): Promise<PriceDropHandlingResult> {
    // 1. Atomic Idempotency Check (Effectively-Once processing)
    const inserted = await this.db
      .insert(processedEvents)
      .values({
        eventId: event.id,
        consumerName: CONSUMER_NAME,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted.length === 0) {
      this.logger.warn(`Event ${event.id} was already processed by ${CONSUMER_NAME}. Skipping duplicate.`);
      return { alertsEvaluated: 0, emailsSent: 0, duplicatesSkipped: true };
    }

    // 2. Fetch Product Details
    const [product] = await this.db
      .select({ title: trackedProducts.title, url: trackedProducts.url })
      .from(trackedProducts)
      .where(eq(trackedProducts.id, event.payload.productId))
      .limit(1);

    if (!product) {
      this.logger.error(`Product ${event.payload.productId} not found for price drop event ${event.id}`);
      return { alertsEvaluated: 0, emailsSent: 0, duplicatesSkipped: false };
    }

    // 3. Query Active User Alerts meeting target price threshold
    const candidateAlerts = await this.db
      .select()
      .from(userAlerts)
      .where(
        and(
          eq(userAlerts.productId, event.payload.productId),
          eq(userAlerts.isActive, true),
          sql`${userAlerts.targetPriceMinorUnits} >= ${event.payload.newPriceMinorUnits}`,
        ),
      );

    if (candidateAlerts.length === 0) {
      this.logger.log(`No active alerts met the price threshold for product ${event.payload.productId}`);
      return { alertsEvaluated: 0, emailsSent: 0, duplicatesSkipped: false };
    }

    // 4. Filter by 24h Cooldown to prevent notification fatigue
    const now = Date.now();
    const eligibleAlerts = candidateAlerts.filter((alert) => {
      if (!alert.lastNotifiedAt) {
        return true; // Never notified before
      }

      const elapsed = now - new Date(alert.lastNotifiedAt).getTime();
      if (elapsed >= TWENTY_FOUR_HOURS_MS) {
        return true; // Cooldown expired (>24h)
      }

      // If within 24h, only notify if the price dropped lower than last notified price
      if (alert.lastNotifiedPriceMinorUnits && event.payload.newPriceMinorUnits < alert.lastNotifiedPriceMinorUnits) {
        return true;
      }

      return false;
    });

    // 5. Dispatch Emails via NotificationPort
    let sentCount = 0;

    for (const alert of eligibleAlerts) {
      const emailData: PriceDropAlertEmailData = {
        userEmail: alert.userEmail,
        productTitle: product.title,
        productUrl: product.url,
        oldPriceMinorUnits: event.payload.oldPriceMinorUnits,
        newPriceMinorUnits: event.payload.newPriceMinorUnits,
        dropPercentage: event.payload.dropPercentage,
        currency: event.payload.currency,
        alertId: alert.id,
      };

      const sendResult = await this.notifier.sendPriceDropAlert(emailData);

      if (sendResult.isOk()) {
        sentCount++;
        // Update last notified timestamp and price
        await this.db
          .update(userAlerts)
          .set({
            lastNotifiedAt: sql`NOW()`,
            lastNotifiedPriceMinorUnits: event.payload.newPriceMinorUnits,
          })
          .where(eq(userAlerts.id, alert.id));
      }
    }

    this.logger.log(
      `Price drop event ${event.id} handled: ${eligibleAlerts.length}/${candidateAlerts.length} eligible alerts notified, ${sentCount} emails dispatched.`,
    );

    return {
      alertsEvaluated: candidateAlerts.length,
      emailsSent: sentCount,
      duplicatesSkipped: false,
    };
  }
}
