/**
 * Money helpers. All amounts are stored as integer MINOR UNITS (paise for INR).
 * Never use floats for financial math.
 */

export function toMinor(major: number | string): number {
  const n = typeof major === "string" ? Number(major) : major;
  if (!Number.isFinite(n)) throw new Error("Invalid money amount");
  return Math.round(n * 100);
}

export function toMajor(minor: number): number {
  return minor / 100;
}

export function formatMoney(minor: number, currency = "INR", locale = "en-IN"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(minor / 100);
}

export function pctOf(amountMinor: number, percent: number): number {
  return Math.round((amountMinor * percent) / 100);
}

export interface PriceBreakdown {
  baseMinor: number;
  discountMinor: number;
  taxMinor: number;
  joiningFeeMinor: number;
  totalMinor: number;
}

/** Compute payable total. Tax is applied on (base - discount) when taxInclusive=false. */
export function computePrice(opts: {
  baseMinor: number;
  discountPercent?: number;
  discountMinor?: number;
  taxPercent?: number;
  taxInclusive?: boolean;
  joiningFeeMinor?: number;
}): PriceBreakdown {
  const discountMinor =
    opts.discountMinor ?? (opts.discountPercent ? pctOf(opts.baseMinor, opts.discountPercent) : 0);
  const discounted = Math.max(0, opts.baseMinor - discountMinor);
  const taxPercent = opts.taxPercent ?? 0;
  const taxMinor = opts.taxInclusive
    ? Math.round((discounted * taxPercent) / (100 + taxPercent))
    : pctOf(discounted, taxPercent);
  const joiningFeeMinor = opts.joiningFeeMinor ?? 0;
  return {
    baseMinor: opts.baseMinor,
    discountMinor,
    taxMinor,
    joiningFeeMinor,
    totalMinor: discounted + taxMinor + joiningFeeMinor,
  };
}
