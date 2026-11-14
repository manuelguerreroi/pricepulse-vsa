import { describe, it, expect } from 'vitest';
import { validateUrlSafety, SsrfViolationError } from './ssrf.validator';

describe('Anti-SSRF Validator', () => {
  it('should block localhost and 127.0.0.1 loopback', async () => {
    const res1 = await validateUrlSafety('http://localhost:3000/api');
    expect(res1.isErr()).toBe(true);

    const res2 = await validateUrlSafety('http://127.0.0.1:5432');
    expect(res2.isErr()).toBe(true);
  });

  it('should block cloud metadata link-local address 169.254.169.254', async () => {
    const res = await validateUrlSafety('http://169.254.169.254/latest/meta-data/');
    expect(res.isErr()).toBe(true);
    if (res.isErr()) {
      expect(res.error).toBeInstanceOf(SsrfViolationError);
    }
  });

  it('should block private RFC 1918 addresses (10.x, 192.168.x, 172.16-31.x)', async () => {
    const res1 = await validateUrlSafety('http://192.168.1.1/admin');
    expect(res1.isErr()).toBe(true);

    const res2 = await validateUrlSafety('http://10.0.0.5/api');
    expect(res2.isErr()).toBe(true);
  });

  it('should reject non-HTTP protocols like file://, gopher://, ftp://', async () => {
    const res = await validateUrlSafety('file:///etc/passwd');
    expect(res.isErr()).toBe(true);
  });
});
