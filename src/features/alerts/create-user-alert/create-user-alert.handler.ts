import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { Result } from '@shared/domain/result';
import { DRIZZLE_DB, DrizzleDb } from '@shared/infra/database/database.module';
import { trackedProducts, userAlerts } from '@shared/infra/database/schema';
import { CreateUserAlertDto, UserAlertResponseDto } from './create-user-alert.dto';

export class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Product with ID "${productId}" was not found`);
    this.name = 'ProductNotFoundError';
  }
}

export class ActiveAlertAlreadyExistsError extends Error {
  constructor(email: string, productId: string) {
    super(`An active alert already exists for email "${email}" on product "${productId}"`);
    this.name = 'ActiveAlertAlreadyExistsError';
  }
}

export class InvalidTargetPriceError extends Error {
  constructor(targetPrice: number, currentPrice: number) {
    super(`Target price (${targetPrice}) must be strictly lower than current price (${currentPrice})`);
    this.name = 'InvalidTargetPriceError';
  }
}

export type CreateUserAlertError =
  | ProductNotFoundError
  | ActiveAlertAlreadyExistsError
  | InvalidTargetPriceError;

@Injectable()
export class CreateUserAlertHandler {
  private readonly logger = new Logger(CreateUserAlertHandler.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async execute(dto: CreateUserAlertDto): Promise<Result<UserAlertResponseDto, CreateUserAlertError>> {
    const normalizedEmail = dto.userEmail.toLowerCase().trim();

    // 1. Verify Product Exists
    const [product] = await this.db
      .select()
      .from(trackedProducts)
      .where(eq(trackedProducts.id, dto.productId))
      .limit(1);

    if (!product) {
      return Result.err(new ProductNotFoundError(dto.productId));
    }

    // 2. Validate Target Price is strictly lower than current price
    if (dto.targetPriceMinorUnits >= product.currentPriceMinorUnits) {
      return Result.err(new InvalidTargetPriceError(dto.targetPriceMinorUnits, product.currentPriceMinorUnits));
    }

    // 3. Verify No Existing Active Alert for this email + product
    const existingAlert = await this.db
      .select()
      .from(userAlerts)
      .where(
        and(
          eq(userAlerts.userEmail, normalizedEmail),
          eq(userAlerts.productId, dto.productId),
          eq(userAlerts.isActive, true),
        ),
      )
      .limit(1);

    if (existingAlert.length > 0) {
      return Result.err(new ActiveAlertAlreadyExistsError(normalizedEmail, dto.productId));
    }

    // 4. Insert Active Alert
    const [createdAlert] = await this.db
      .insert(userAlerts)
      .values({
        userEmail: normalizedEmail,
        productId: dto.productId,
        targetPriceMinorUnits: dto.targetPriceMinorUnits,
        isActive: true,
      })
      .returning();

    this.logger.log(`Active alert created: ${createdAlert.id} for ${normalizedEmail} on product ${dto.productId}`);

    return Result.ok({
      id: createdAlert.id,
      userEmail: createdAlert.userEmail,
      productId: createdAlert.productId,
      targetPriceMinorUnits: createdAlert.targetPriceMinorUnits,
      isActive: createdAlert.isActive,
      createdAt: createdAlert.createdAt.toISOString(),
    });
  }
}
