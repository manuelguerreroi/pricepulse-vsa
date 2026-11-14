import dns from 'dns/promises';
import { Result } from '../../domain/result';

export class SsrfViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfViolationError';
  }
}

function isPrivateIp(ip: string): boolean {
  // IPv4 Loopback
  if (ip.startsWith('127.')) return true;

  // IPv4 Zero / Broadcast
  if (ip === '0.0.0.0' || ip === '255.255.255.255') return true;

  // IPv4 Link-local / Cloud Metadata (169.254.0.0/16)
  if (ip.startsWith('169.254.')) return true;

  // IPv4 Private (RFC 1918)
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;

  // 172.16.0.0 - 172.31.255.255
  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    if (parts.length >= 2) {
      const secondOctet = parseInt(parts[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return true;
      }
    }
  }

  // IPv6 Loopback / Link-local
  if (ip === '::1' || ip === '::') return true;
  if (ip.toLowerCase().startsWith('fe80:') || ip.toLowerCase().startsWith('fc00:')) return true;

  return false;
}

export async function validateUrlSafety(rawUrl: string): Promise<Result<void, SsrfViolationError>> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return Result.err(new SsrfViolationError(`Malformed URL: ${rawUrl}`));
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return Result.err(new SsrfViolationError(`Protocol ${parsed.protocol} is forbidden. Only HTTP/HTTPS are allowed.`));
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject obvious local hostnames
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return Result.err(new SsrfViolationError(`Host "${hostname}" points to an internal/local address`));
  }

  // Pre-resolve DNS to detect private IP targets
  try {
    const lookup = await dns.lookup(hostname);
    if (isPrivateIp(lookup.address)) {
      return Result.err(new SsrfViolationError(`Host "${hostname}" resolves to private/loopback IP: ${lookup.address}`));
    }
  } catch (error) {
    return Result.err(new SsrfViolationError(`DNS resolution failed for host "${hostname}": ${error instanceof Error ? error.message : String(error)}`));
  }

  return Result.ok(undefined);
}
