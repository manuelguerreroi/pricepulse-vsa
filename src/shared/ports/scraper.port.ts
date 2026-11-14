import { Result } from '../domain/result';

export interface ScrapedProduct {
  title: string;
  priceMinorUnits: number;
  currency: string;
}

export interface ScrapingError {
  code: 'UNREACHABLE' | 'BLOCKED' | 'NOT_FOUND' | 'INVALID_CONTENT';
  message: string;
}

export const SCRAPER_PORT = Symbol('SCRAPER_PORT');

export interface ScraperPort {
  scrape(url: string): Promise<Result<ScrapedProduct, ScrapingError>>;
}
