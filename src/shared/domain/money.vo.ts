import { Result } from './result';

export class InvalidMoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMoneyError';
  }
}

export class CurrencyMismatchError extends Error {
  constructor(c1: string, c2: string) {
    super(`Cannot compare or operate on different currencies: ${c1} and ${c2}`);
    this.name = 'CurrencyMismatchError';
  }
}

const SCALE_FACTORS: Record<string, number> = {
  CLP: 1,
  JPY: 1,
  USD: 100,
  EUR: 100,
  BRL: 100,
};

export class Money {
  readonly amountMinorUnits: number;
  readonly currency: string;

  private constructor(amountMinorUnits: number, currency: string) {
    this.amountMinorUnits = amountMinorUnits;
    this.currency = currency.toUpperCase();
  }

  static create(amountMinorUnits: number, currency = 'CLP'): Result<Money, InvalidMoneyError> {
    if (!Number.isInteger(amountMinorUnits)) {
      return Result.err(new InvalidMoneyError(`Amount must be an integer in minor units, received: ${amountMinorUnits}`));
    }

    if (amountMinorUnits <= 0) {
      return Result.err(new InvalidMoneyError(`Amount must be strictly positive (> 0), received: ${amountMinorUnits}`));
    }

    const normalizedCurrency = currency.toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      return Result.err(new InvalidMoneyError(`Currency must be a 3-letter ISO 4217 code, received: ${currency}`));
    }

    return Result.ok(new Money(amountMinorUnits, normalizedCurrency));
  }

  static fromDecimal(decimalAmount: number, currency = 'CLP'): Result<Money, InvalidMoneyError> {
    const scale = SCALE_FACTORS[currency.toUpperCase()] ?? 100;
    const minorUnits = Math.round(decimalAmount * scale);
    return Money.create(minorUnits, currency);
  }

  toDecimal(): number {
    const scale = SCALE_FACTORS[this.currency] ?? 100;
    return this.amountMinorUnits / scale;
  }

  isLessThan(other: Money): boolean {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
    return this.amountMinorUnits < other.amountMinorUnits;
  }

  /**
   * Calculates the percentage drop from this money to a lower price.
   * Returns positive percentage (e.g. 20 for a 20% drop).
   * Returns 0 if new price is equal or higher.
   */
  percentageDropTo(newPrice: Money): number {
    if (this.currency !== newPrice.currency) {
      throw new CurrencyMismatchError(this.currency, newPrice.currency);
    }

    if (!newPrice.isLessThan(this)) {
      return 0;
    }

    const difference = this.amountMinorUnits - newPrice.amountMinorUnits;
    const percentage = (difference / this.amountMinorUnits) * 100;
    return Math.round(percentage * 100) / 100; // Round to 2 decimal places
  }

  format(): string {
    const decimal = this.toDecimal();
    if (this.currency === 'CLP') {
      return `$${decimal.toLocaleString('es-CL')} CLP`;
    }
    return `$${decimal.toFixed(2)} ${this.currency}`;
  }
}
