import { describe, it, expect } from 'vitest';
import { TrackedUrl, InvalidUrlError } from './tracked-url.vo';

describe('TrackedUrl Value Object', () => {
  it('should successfully normalize e-commerce URL and strip tracking parameters', () => {
    const raw = 'https://www.mercadolibre.cl/p/MLC12345?utm_source=google&utm_medium=cpc&ref=facebook#reviews';
    const result = TrackedUrl.create(raw);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.normalizedUrl).toBe('https://mercadolibre.cl/p/MLC12345');
      expect(result.value.domain).toBe('mercadolibre.cl');
    }
  });

  it('should preserve functional query parameters while stripping tracking params', () => {
    const raw = 'https://mercadolibre.cl/item?id=999&utm_campaign=winter_sale&color=blue';
    const result = TrackedUrl.create(raw);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.normalizedUrl).toBe('https://mercadolibre.cl/item?color=blue&id=999');
    }
  });

  it('should reject non-HTTP/HTTPS protocols', () => {
    const ftp = TrackedUrl.create('ftp://example.com/item');
    expect(ftp.isErr()).toBe(true);

    const file = TrackedUrl.create('file:///etc/passwd');
    expect(file.isErr()).toBe(true);
  });

  it('should reject malformed URLs', () => {
    const malformed = TrackedUrl.create('not-a-valid-url');
    expect(malformed.isErr()).toBe(true);
    if (malformed.isErr()) {
      expect(malformed.error).toBeInstanceOf(InvalidUrlError);
    }
  });
});
