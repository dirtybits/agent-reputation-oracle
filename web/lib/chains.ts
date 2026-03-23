export const SOLANA_MAINNET_CHAIN_CONTEXT = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
export const SOLANA_DEVNET_CHAIN_CONTEXT = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
export const SOLANA_TESTNET_CHAIN_CONTEXT = 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z';
export const ETHEREUM_MAINNET_CHAIN_CONTEXT = 'eip155:1';
export const BASE_CHAIN_CONTEXT = 'eip155:8453';
export const POLYGON_CHAIN_CONTEXT = 'eip155:137';

export const CHAIN_ALIASES: Record<string, string> = {
  [SOLANA_MAINNET_CHAIN_CONTEXT]: 'Solana',
  [SOLANA_DEVNET_CHAIN_CONTEXT]: 'Solana Devnet',
  [SOLANA_TESTNET_CHAIN_CONTEXT]: 'Solana Testnet',
  [ETHEREUM_MAINNET_CHAIN_CONTEXT]: 'Ethereum',
  [BASE_CHAIN_CONTEXT]: 'Base',
  [POLYGON_CHAIN_CONTEXT]: 'Polygon',
};

const LEGACY_CHAIN_CONTEXTS: Record<string, string> = {
  'solana-mainnet': SOLANA_MAINNET_CHAIN_CONTEXT,
  'solana:mainnet': SOLANA_MAINNET_CHAIN_CONTEXT,
  'solana:mainnet-beta': SOLANA_MAINNET_CHAIN_CONTEXT,
  'solana-devnet': SOLANA_DEVNET_CHAIN_CONTEXT,
  'solana:devnet': SOLANA_DEVNET_CHAIN_CONTEXT,
  'solana-testnet': SOLANA_TESTNET_CHAIN_CONTEXT,
  'solana:testnet': SOLANA_TESTNET_CHAIN_CONTEXT,
  ethereum: ETHEREUM_MAINNET_CHAIN_CONTEXT,
  base: BASE_CHAIN_CONTEXT,
  polygon: POLYGON_CHAIN_CONTEXT,
};

function inferSolanaChainContextFromRpcUrl(rpcUrl?: string | null): string | null {
  if (!rpcUrl) return null;

  const lower = rpcUrl.toLowerCase();

  if (lower.includes('devnet')) return SOLANA_DEVNET_CHAIN_CONTEXT;
  if (lower.includes('testnet')) return SOLANA_TESTNET_CHAIN_CONTEXT;
  if (lower.includes('mainnet')) return SOLANA_MAINNET_CHAIN_CONTEXT;

  return null;
}

export function getConfiguredSolanaChainContext(): string {
  const rpcUrl = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || null;
  const inferred = inferSolanaChainContextFromRpcUrl(rpcUrl) ?? SOLANA_DEVNET_CHAIN_CONTEXT;
  const configured = process.env.SOLANA_CHAIN_CONTEXT || process.env.NEXT_PUBLIC_SOLANA_CHAIN_CONTEXT;

  if (!configured) return inferred;

  const normalized = normalizeChainContext(configured, {
    defaultLegacySolanaChainContext: inferred,
  });

  return normalized ?? inferred;
}

export function normalizeChainContext(
  value: string | null | undefined,
  options?: { defaultLegacySolanaChainContext?: string }
): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (CHAIN_ALIASES[trimmed]) return trimmed;

  const lower = trimmed.toLowerCase();
  if (lower === 'solana') {
    return options?.defaultLegacySolanaChainContext ?? null;
  }

  return LEGACY_CHAIN_CONTEXTS[lower] ?? null;
}

export function normalizePersistedChainContext(value: string | null | undefined): string {
  if (!value || !value.trim()) {
    return getConfiguredSolanaChainContext();
  }

  const normalized = normalizeChainContext(value, {
    defaultLegacySolanaChainContext: getConfiguredSolanaChainContext(),
  });

  return normalized ?? value;
}

export function normalizeInputChainContext(value: string | null | undefined): string | null {
  return normalizeChainContext(value, {
    defaultLegacySolanaChainContext: getConfiguredSolanaChainContext(),
  });
}

export function getChainDisplayLabel(value: string | null | undefined): string {
  const normalized = normalizeInputChainContext(value);
  return (normalized && CHAIN_ALIASES[normalized]) || value || 'Unknown network';
}
