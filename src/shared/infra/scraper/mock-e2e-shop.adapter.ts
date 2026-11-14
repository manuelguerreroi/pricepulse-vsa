import { Injectable } from '@nestjs/common';
import { Result } from '../../domain/result';
import { ScraperPort, ScrapedProduct, ScrapingError } from '../../ports/scraper.port';

@Injectable()
export class MockE2EShopAdapter implements ScraperPort {
  async scrape(url: string): Promise<Result<ScrapedProduct, ScrapingError>> {
    if (url.includes('not-found') || url.includes('404')) {
      return Result.err({
        code: 'NOT_FOUND',
        message: 'Product page does not exist or has been removed',
      });
    }

    if (url.includes('blocked') || url.includes('captcha')) {
      return Result.err({
        code: 'BLOCKED',
        message: 'Scraping request was blocked by anti-bot challenge',
      });
    }

    // Support dynamic mock price via query param for tests
    let priceMinorUnits = 15000;
    let currency = 'CLP';

    try {
      const parsed = new URL(url);
      const mockPriceParam = parsed.searchParams.get('mock_price');
      if (mockPriceParam) {
        priceMinorUnits = parseInt(mockPriceParam, 10);
      }
      const mockCurrencyParam = parsed.searchParams.get('mock_currency');
      if (mockCurrencyParam) {
        currency = mockCurrencyParam.toUpperCase();
      }
    } catch {
      // Fallback to default
    }

    return Result.ok({
      title: 'Mock E2E E-Commerce Product',
      priceMinorUnits,
      currency,
    });
  }
}
