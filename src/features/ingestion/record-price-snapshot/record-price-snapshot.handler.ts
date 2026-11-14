import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { Result } from '@shared/domain/result';
import { Money } from '@shared/domain/money.vo';
import { DRIZZLE_DB, DrizzleDb } from '@shared/infra/database/database.module';
import { trackedProducts, priceSnapshots, outboxEvents } from '@shared/infra/database/schema';
import { RecordPriceSnapshotDto, RecordPriceSnapshotResponseDto } from './record-price-snapshot.dto';

export class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Tracked product with ID "${productId}" was not found`);
    this.name = 'ProductNotFoundError';
  }
}

export class InvalidPriceError extends Error {
  constructor(price: number) {
    super(`Price must be strictly positive (> 0), received: ${price}`);
    this.name = 'InvalidPriceError';
  }
}

export type RecordPriceSnapshotError = ProductNotFoundError | InvalidPriceError;

@Injectable()
export class RecordPriceSnapshotHandler {
  private readonly logger = new Logger(RecordPriceSnapshotHandler.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async execute(
    dto: RecordPriceSnapshotDto,
    traceId?: string,
  ): Promise<Result<RecordPriceSnapshotResponseDto, RecordPriceSnapshotError>> {
    const correlationId = traceId || randomUUID();

    // 0. Defensive Price Validation
    if (!Number.isInteger(dto.newPriceMinorUnits) || dto.newPriceMinorUnits <= 0) {
      return Result.err(new InvalidPriceError(dto.newPriceMinorUnits));
    }

    // 1. Verify Product Exists
    const [product] = await this.db
      .select()
      .from(trackedProducts)
      .where(eq(trackedProducts.id, dto.productId))
      .limit(1);

    if (!product) {
      return Result.err(new ProductNotFoundError(dto.productId));
    }

    const oldPrice = product.currentPriceMinorUnits;
    const newPrice = dto.newPriceMinorUnits;
    const currency = product.currency;

    const isPriceDrop = newPrice < oldPrice;
    let dropPercentage = 0;

    if (isPriceDrop) {
      const oldMoneyRes = Money.create(oldPrice, currency);
      const newMoneyRes = Money.create(newPrice, currency);
      if (oldMoneyRes.isOk() && newMoneyRes.isOk()) {
        dropPercentage = oldMoneyRes.value.percentageDropTo(newMoneyRes.value);
      }
    }

    // 2. Atomic Transaction: Snapshot + Product Update + Conditional Outbox Event
    const snapshot = await this.db.transaction(async (tx) => {
      // a) Insert New Price Snapshot
      const [insertedSnapshot] = await tx
        .insert(priceSnapshots)
        .values({
          productId: product.id,
          priceMinorUnits: newPrice,
          currency,
        })
        .returning();

      // b) Always update tracked_products with latest price and timestamp
      await tx
        .update(trackedProducts)
        .set({
          currentPriceMinorUnits: newPrice,
          updatedAt: sql`NOW()`,
        })
        .where(eq(trackedProducts.id, product.id));

      // c) If price dropped, emit PriceDroppedEventV1 to Transactional Outbox
      if (isPriceDrop) {
        await tx.insert(outboxEvents).values({
          eventType: 'PriceDroppedEventV1',
          payload: {
            productId: product.id,
            oldPriceMinorUnits: oldPrice,
            newPriceMinorUnits: newPrice,
            dropPercentage,
            currency,
            snapshotId: insertedSnapshot.id,
          },
          traceId: correlationId,
          status: 'PENDING',
        });
      }

      return insertedSnapshot;
    });

    this.logger.log(
      `Snapshot recorded for product ${product.id}: ${oldPrice} -> ${newPrice} (Drop: ${isPriceDrop ? `${dropPercentage}%` : 'No'})`,
    );

    return Result.ok({
      snapshotId: snapshot.id,
      productId: product.id,
      oldPriceMinorUnits: oldPrice,
      newPriceMinorUnits: newPrice,
      currency,
      isPriceDrop,
      dropPercentage,
      recordedAt: snapshot.recordedAt.toISOString(),
    });
  }
}
