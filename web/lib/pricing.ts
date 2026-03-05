export const PRICING = {
  SOL: {
    symbol: 'SOL',
    decimals: 9,
    minPrice: 0.001,
    defaultPrice: 0.001,
    step: 0.001,
  },
} as const;

export type CurrencyKey = keyof typeof PRICING;

export const DEFAULT_CURRENCY: CurrencyKey = 'SOL';

export function formatMinPrice(currency: CurrencyKey = DEFAULT_CURRENCY): string {
  return `${PRICING[currency].minPrice} ${PRICING[currency].symbol}`;
}

export function toLamports(sol: number): number {
  return Math.round(sol * 10 ** PRICING.SOL.decimals);
}

export function fromLamports(lamports: number): number {
  return lamports / 10 ** PRICING.SOL.decimals;
}
