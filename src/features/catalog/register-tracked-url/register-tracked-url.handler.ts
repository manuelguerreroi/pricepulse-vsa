import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { Result } from '@shared/domain/result';
import { TrackedUrl, InvalidUrlError } from '@shared/domain/tracked-url.vo';
import { validateUrlSafety, SsrfViolationError } from '@shared/infra/security/ssrf.validator';
import { DRIZZLE_DB, DrizzleDb } from '@shared/infra/database/database.module';
import { trackedProducts, priceSnapshots, outboxEvents } from '@shared/infra/database/schema';
import { SCRAPER_PORT, ScraperPort, ScrapingError } from '@shared/ports/scraper.port';
import { RegisterTrackedUrlDto, TrackedProductResponseDto } from './register-tracked-url.dto';

export class ProductAlreadyTrackedError extends Error {
  constructor(url: string) {
    super(`Product with URL "${url}" is already being tracked`);
    this.name = 'ProductAlreadyTrackedError';
  }
}

export class ScrapingFailedError extends Error {
  readonly code: string;
  constructor(error: ScrapingError) {
    super(`Scraping failed (${error.code}): ${error.message}`);
    this.name = 'ScrapingFailedError';
    this.code = error.code;
  }
}

export type RegisterTrackedUrlError =
  | InvalidUrlError
  | SsrfViolationError
  | ProductAlreadyTrackedError
  | ScrapingFailedError;

@Injectable()
export class RegisterTrackedUrlHandler {
  private readonly logger = new Logger(RegisterTrackedUrlHandler.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    @Inject(SCRAPER_PORT) private readonly scraper: ScraperPort,
  ) {}

  async execute(
    dto: RegisterTrackedUrlDto,
    traceId?: string,
  ): Promise<Result<TrackedProductResponseDto, RegisterTrackedUrlError>> {
    const correlationId = traceId || randomUUID();

    // 1. Anti-SSRF Validation
    const safetyResult = await validateUrlSafety(dto.url);
    if (safetyResult.isErr()) {
      this.logger.warn(`Anti-SSRF blocked registration for URL: ${dto.url}`, safetyResult.error.message);
      return Result.err(safetyResult.error);
    }

    // 2. URL Normalization
    const urlResult = TrackedUrl.create(dto.url);
    if (urlResult.isErr()) {
      return Result.err(urlResult.error);
    }
    const { normalizedUrl, domain } = urlResult.value;

    // 3. Check for existing product (Idempotency / Conflict detection)
    const existing = await this.db
      .select()
      .from(trackedProducts)
      .where(eq(trackedProducts.url, normalizedUrl))
      .limit(1);

    if (existing.length > 0) {
      return Result.err(new ProductAlreadyTrackedError(normalizedUrl));
    }

    // 4. Initial Scraping
    const scrapeResult = await this.scraper.scrape(normalizedUrl);
    if (scrapeResult.isErr()) {
      return Result.err(new ScrapingFailedError(scrapeResult.error));
    }
    const scraped = scrapeResult.value;

    // 5. Atomic Drizzle Transaction: Product + Snapshot + Outbox Event
    const newProduct = await this.db.transaction(async (tx) => {
      // a) Insert Tracked Product
      const [insertedProduct] = await tx
        .insert(trackedProducts)
        .values({
          url: normalizedUrl,
          domain,
          title: scraped.title,
          currentPriceMinorUnits: scraped.priceMinorUnits,
          currency: scraped.currency,
          status: 'ACTIVE',
        })
        .returning();

      // b) Insert Initial Price Snapshot
      await tx.insert(priceSnapshots).values({
        productId: insertedProduct.id,
        priceMinorUnits: scraped.priceMinorUnits,
        currency: scraped.currency,
      });

      // c) Insert Transactional Outbox Event
      await tx.insert(outboxEvents).values({
        eventType: 'ProductRegisteredEventV1',
        payload: {
          productId: insertedProduct.id,
          url: normalizedUrl,
          domain,
          initialPriceMinorUnits: scraped.priceMinorUnits,
          currency: scraped.currency,
        },
        traceId: correlationId,
        status: 'PENDING',
      });

      return insertedProduct;
    });

    this.logger.log(`Tracked product registered: ${newProduct.id} (${normalizedUrl})`);

    return Result.ok({
      id: newProduct.id,
      url: newProduct.url,
      domain: newProduct.domain,
      title: newProduct.title,
      currentPriceMinorUnits: newProduct.currentPriceMinorUnits,
      currency: newProduct.currency,
      status: newProduct.status,
      createdAt: newProduct.createdAt.toISOString(),
    });
  }
}
