import { describe, it, expect } from 'vitest';
import { Money, InvalidMoneyError, CurrencyMismatchError } from './money.vo';

describe('Money Value Object', () => {
  it('should successfully create money in minor units for CLP', () => {
    const result = Money.create(15000, 'CLP');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.amountMinorUnits).toBe(15000);
      expect(result.value.currency).toBe('CLP');
      expect(result.value.toDecimal()).toBe(15000);
    }
  });

  it('should successfully create money for USD with 2 decimals', () => {
    const result = Money.fromDecimal(19.99, 'USD');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.amountMinorUnits).toBe(1999);
      expect(result.value.currency).toBe('USD');
      expect(result.value.toDecimal()).toBe(19.99);
    }
  });

  it('should reject non-integer minor units', () => {
    const result = Money.create(19.99, 'USD');
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(InvalidMoneyError);
    }
  });

  it('should reject zero or negative amounts', () => {
    const zeroResult = Money.create(0, 'USD');
    expect(zeroResult.isErr()).toBe(true);

    const negativeResult = Money.create(-500, 'CLP');
    expect(negativeResult.isErr()).toBe(true);
  });

  it('should correctly compare prices of the same currency', () => {
    const p1 = Money.create(10000, 'CLP');
    const p2 = Money.create(8000, 'CLP');

    if (p1.isOk() && p2.isOk()) {
      expect(p2.value.isLessThan(p1.value)).toBe(true);
      expect(p1.value.isLessThan(p2.value)).toBe(false);
    }
  });

  it('should throw error when comparing different currencies', () => {
    const clp = Money.create(10000, 'CLP');
    const usd = Money.create(1000, 'USD');

    if (clp.isOk() && usd.isOk()) {
      expect(() => clp.value.isLessThan(usd.value)).toThrow(CurrencyMismatchError);
    }
  });

  it('should calculate percentage drop accurately', () => {
    const oldPrice = Money.create(10000, 'CLP');
    const newPrice = Money.create(7500, 'CLP');

    if (oldPrice.isOk() && newPrice.isOk()) {
      // 10000 -> 7500 is a 25% drop
      expect(oldPrice.value.percentageDropTo(newPrice.value)).toBe(25);
    }
  });

  it('should return 0 percentage drop if new price is higher or equal', () => {
    const oldPrice = Money.create(10000, 'CLP');
    const higherPrice = Money.create(12000, 'CLP');
    const equalPrice = Money.create(10000, 'CLP');

    if (oldPrice.isOk() && higherPrice.isOk() && equalPrice.isOk()) {
      expect(oldPrice.value.percentageDropTo(higherPrice.value)).toBe(0);
      expect(oldPrice.value.percentageDropTo(equalPrice.value)).toBe(0);
    }
  });
});
