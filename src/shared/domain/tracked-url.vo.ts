import { Result } from './result';

export class InvalidUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUrlError';
  }
}

// Common tracking query parameters to strip for e-commerce deduplication
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'fbclid',
  'gclid',
  'msclkid',
  '_hsenc',
  '_hsmi',
  'mc_cid',
  'mc_eid',
  'aff_id',
  'tag',
]);

export class TrackedUrl {
  readonly normalizedUrl: string;
  readonly domain: string;

  private constructor(normalizedUrl: string, domain: string) {
    this.normalizedUrl = normalizedUrl;
    this.domain = domain;
  }

  static create(rawUrl: string): Result<TrackedUrl, InvalidUrlError> {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return Result.err(new InvalidUrlError('URL must be a non-empty string'));
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      return Result.err(new InvalidUrlError(`Malformed URL: ${rawUrl}`));
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return Result.err(new InvalidUrlError(`Invalid protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.`));
    }

    if (!parsed.hostname || parsed.hostname.includes(' ')) {
      return Result.err(new InvalidUrlError(`Invalid hostname: ${parsed.hostname}`));
    }

    // Normalize domain (lowercase, remove leading www.)
    const cleanHostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

    // Strip tracking query params
    const cleanParams = new URLSearchParams();
    parsed.searchParams.forEach((val, key) => {
      const lowerKey = key.toLowerCase();
      if (!TRACKING_PARAMS.has(lowerKey) && !lowerKey.startsWith('utm_')) {
        cleanParams.append(key, val);
      }
    });

    // Strip hash fragment, sort query params for deterministic uniqueness
    cleanParams.sort();
    const queryString = cleanParams.toString();

    // Reconstruct normalized URL
    let pathName = parsed.pathname;
    if (pathName.length > 1 && pathName.endsWith('/')) {
      pathName = pathName.slice(0, -1); // Remove trailing slash
    }

    const normalizedUrl = `${parsed.protocol}//${cleanHostname}${pathName}${queryString ? `?${queryString}` : ''}`;

    return Result.ok(new TrackedUrl(normalizedUrl, cleanHostname));
  }
}
