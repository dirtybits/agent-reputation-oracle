import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  BASE_CHAIN_CONTEXT,
  SOLANA_DEVNET_CHAIN_CONTEXT,
  SOLANA_MAINNET_CHAIN_CONTEXT,
  getConfiguredSolanaChainContext,
  normalizeInputChainContext,
  normalizePersistedChainContext,
} from '@/lib/chains';

const ORIGINAL_ENV = { ...process.env };

describe('chains', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SOLANA_CHAIN_CONTEXT;
    delete process.env.NEXT_PUBLIC_SOLANA_CHAIN_CONTEXT;
    delete process.env.SOLANA_RPC_URL;
    delete process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('normalizes legacy aliases to CAIP-2 chain contexts', () => {
    expect(normalizeInputChainContext('solana:mainnet-beta')).toBe(SOLANA_MAINNET_CHAIN_CONTEXT);
    expect(normalizeInputChainContext('solana:devnet')).toBe(SOLANA_DEVNET_CHAIN_CONTEXT);
    expect(normalizeInputChainContext('base')).toBe(BASE_CHAIN_CONTEXT);
  });

  it('uses the configured RPC cluster for bare solana aliases', () => {
    process.env.SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
    expect(normalizeInputChainContext('solana')).toBe(SOLANA_MAINNET_CHAIN_CONTEXT);
  });

  it('defaults to devnet when no explicit cluster is configured', () => {
    expect(getConfiguredSolanaChainContext()).toBe(SOLANA_DEVNET_CHAIN_CONTEXT);
  });

  it('preserves unknown stored values instead of guessing silently', () => {
    expect(normalizePersistedChainContext('custom:unknown-network')).toBe('custom:unknown-network');
  });
});
