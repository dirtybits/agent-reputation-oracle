import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SOLANA_DEVNET_CHAIN_CONTEXT } from '@/lib/chains';
import { discoverSolanaRegistryCandidatesByWallet } from '@/lib/solanaAgentRegistry';

const ORIGINAL_ENV = { ...process.env };

describe('solanaAgentRegistry', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SOLANA_AGENT_REGISTRY_INDEXER_URL;
    delete process.env.SOLANA_AGENT_REGISTRY_INDEXER_FALLBACK_URL;
    delete process.env.SOLANA_AGENT_REGISTRY_PROGRAM_ID;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('dedupes owner and operational wallet matches into one candidate', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              byOwner: [
                {
                  id: 'Asset111',
                  agentId: '42',
                  owner: 'Wallet111',
                  agentWallet: 'OpWallet111',
                  agentURI: 'https://example.com/agent.json',
                  registrationFile: {
                    name: 'Example Agent',
                    description: 'Test agent',
                    image: 'ipfs://image',
                  },
                  metadata: [],
                  solana: {
                    assetPubkey: 'Asset111',
                    verificationStatus: 'FINALIZED',
                  },
                },
              ],
              byWallet: [
                {
                  id: 'Asset111',
                  agentId: '42',
                  owner: 'Wallet111',
                  agentWallet: 'OpWallet111',
                  agentURI: 'https://example.com/agent.json',
                  registrationFile: {
                    name: 'Example Agent',
                    description: 'Test agent',
                    image: 'ipfs://image',
                  },
                  metadata: [],
                  solana: {
                    assetPubkey: 'Asset111',
                    verificationStatus: 'FINALIZED',
                  },
                },
              ],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            registrations: [{ agentRegistry: 'registry', agentId: '42' }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

    vi.stubGlobal('fetch', fetchMock);

    const candidates = await discoverSolanaRegistryCandidatesByWallet('Wallet111', {
      chainContext: SOLANA_DEVNET_CHAIN_CONTEXT,
      useCache: false,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      coreAssetPubkey: 'Asset111',
      ownerWallet: 'Wallet111',
      operationalWallet: 'OpWallet111',
      displayName: 'Example Agent',
      externalAgentId: '42',
      matchType: 'both',
      rawUpstreamChainLabel: 'solana-devnet',
    });
    expect(candidates[0].registrations).toHaveLength(1);
  });

  it('returns an empty list when the indexer finds no candidates', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: { byOwner: [], byWallet: [] } }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const candidates = await discoverSolanaRegistryCandidatesByWallet('Wallet111', {
      chainContext: SOLANA_DEVNET_CHAIN_CONTEXT,
      useCache: false,
    });

    expect(candidates).toEqual([]);
  });

  it('returns an empty list for unsupported chain contexts', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const candidates = await discoverSolanaRegistryCandidatesByWallet('Wallet111', {
      chainContext: 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z',
      useCache: false,
    });

    expect(candidates).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
