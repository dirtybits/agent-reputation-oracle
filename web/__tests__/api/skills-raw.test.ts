import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
}));

vi.mock('@/lib/onchain', () => ({
  getOnChainPrice: vi.fn(),
}));

vi.mock('@/lib/x402', () => ({
  generatePaymentRequirement: vi.fn(),
  verifyPaymentProof: vi.fn(),
}));

import { GET } from '@/app/api/skills/[id]/raw/route';
import { sql } from '@/lib/db';
import { getOnChainPrice } from '@/lib/onchain';
import { generatePaymentRequirement, verifyPaymentProof } from '@/lib/x402';

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;
const mockOnChain = getOnChainPrice as unknown as ReturnType<typeof vi.fn>;
const mockGenerate = generatePaymentRequirement as unknown as ReturnType<typeof vi.fn>;
const mockVerify = verifyPaymentProof as unknown as ReturnType<typeof vi.fn>;

function makeRequest(id: string, headers: Record<string, string> = {}) {
  const req = new NextRequest(`http://localhost/api/skills/${id}/raw`, {
    method: 'GET',
    headers,
  });
  const params = Promise.resolve({ id });
  return { req, params };
}

const SKILL_CONTENT = '# My Skill\nHello world';

describe('GET /api/skills/[id]/raw', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when skill not found', async () => {
    const dbQuery = vi.fn().mockResolvedValueOnce([]);
    mockSql.mockReturnValue(dbQuery);

    const { req, params } = makeRequest('uuid-nope');
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
  });

  it('returns content directly for free skill (no on_chain_address)', async () => {
    const dbQuery = vi.fn()
      .mockResolvedValueOnce([{ id: 'uuid-1', on_chain_address: null, author_pubkey: 'A', skill_id: 's1', content: SKILL_CONTENT }])
      .mockResolvedValueOnce([]);
    mockSql.mockReturnValue(dbQuery);

    const { req, params } = makeRequest('uuid-1');
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe(SKILL_CONTENT);
    expect(res.headers.get('Content-Type')).toContain('text/markdown');
  });

  it('returns content directly for skill with 0 on-chain price', async () => {
    const dbQuery = vi.fn()
      .mockResolvedValueOnce([{ id: 'uuid-2', on_chain_address: 'Chain1', author_pubkey: 'A', skill_id: 's2', content: SKILL_CONTENT }])
      .mockResolvedValueOnce([]);
    mockSql.mockReturnValue(dbQuery);
    mockOnChain.mockResolvedValue({ price: 0, author: 'A' });

    const { req, params } = makeRequest('uuid-2');
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe(SKILL_CONTENT);
  });

  it('returns 402 with purchaseSkill requirement for paid skill without proof', async () => {
    const dbQuery = vi.fn().mockResolvedValueOnce([
      { id: 'uuid-3', on_chain_address: 'Chain2', author_pubkey: 'A', skill_id: 's3', content: SKILL_CONTENT },
    ]);
    mockSql.mockReturnValue(dbQuery);
    mockOnChain.mockResolvedValue({ price: 100_000_000, author: 'Author3' });
    mockGenerate.mockReturnValue({
      scheme: 'exact',
      network: 'solana',
      programId: 'ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf',
      instruction: 'purchaseSkill',
      skillListingAddress: 'Chain2',
      amount: 100_000_000,
    });

    const { req, params } = makeRequest('uuid-3');
    const res = await GET(req, { params });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toContain('Payment required');
    expect(body.message).toContain('purchaseSkill');
    expect(body.requirement).toBeTruthy();
    expect(body.requirement.instruction).toBe('purchaseSkill');
    expect(body.requirement.skillListingAddress).toBe('Chain2');
    expect(res.headers.get('X-Payment')).toBeTruthy();
  });

  it('passes skillListingAddress (not authorPubkey) to generatePaymentRequirement', async () => {
    const dbQuery = vi.fn().mockResolvedValueOnce([
      { id: 'uuid-3b', on_chain_address: 'ChainAddr99', author_pubkey: 'AuthorX', skill_id: 's3b', content: SKILL_CONTENT },
    ]);
    mockSql.mockReturnValue(dbQuery);
    mockOnChain.mockResolvedValue({ price: 50_000_000, author: 'AuthorX' });
    mockGenerate.mockReturnValue({ scheme: 'exact' });

    const { req, params } = makeRequest('uuid-3b');
    await GET(req, { params });

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        skillListingAddress: 'ChainAddr99',
        priceLamports: 50_000_000,
      })
    );
    expect(mockGenerate).not.toHaveBeenCalledWith(
      expect.objectContaining({ authorPubkey: expect.anything() })
    );
  });

  it('returns content when valid payment proof is provided', async () => {
    const dbQuery = vi.fn()
      .mockResolvedValueOnce([{ id: 'uuid-4', on_chain_address: 'Chain3', author_pubkey: 'A', skill_id: 's4', content: SKILL_CONTENT }])
      .mockResolvedValueOnce([]);
    mockSql.mockReturnValue(dbQuery);
    mockOnChain.mockResolvedValue({ price: 50_000_000, author: 'Author4' });
    mockVerify.mockResolvedValue({ status: 'valid', paymentRef: 'ref-1' });

    const proof = JSON.stringify({ buyer: 'BuyerKey', txSignature: 'tx123', requirement: {} });
    const { req, params } = makeRequest('uuid-4', { 'x-payment-proof': proof });
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe(SKILL_CONTENT);
  });

  it('returns 402 when payment proof verification fails', async () => {
    const dbQuery = vi.fn().mockResolvedValueOnce([
      { id: 'uuid-5', on_chain_address: 'Chain4', author_pubkey: 'A', skill_id: 's5', content: SKILL_CONTENT },
    ]);
    mockSql.mockReturnValue(dbQuery);
    mockOnChain.mockResolvedValue({ price: 50_000_000, author: 'Author5' });
    mockVerify.mockResolvedValue({ status: 'invalid', paymentRef: 'ref-2', error: 'Purchase not found' });

    const proof = JSON.stringify({ buyer: 'BuyerKey', txSignature: 'badtx', requirement: {} });
    const { req, params } = makeRequest('uuid-5', { 'x-payment-proof': proof });
    const res = await GET(req, { params });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toContain('verification failed');
  });

  it('returns 400 when x-payment-proof header is malformed', async () => {
    const dbQuery = vi.fn().mockResolvedValueOnce([
      { id: 'uuid-6', on_chain_address: 'Chain5', author_pubkey: 'A', skill_id: 's6', content: SKILL_CONTENT },
    ]);
    mockSql.mockReturnValue(dbQuery);
    mockOnChain.mockResolvedValue({ price: 50_000_000, author: 'Author6' });

    const { req, params } = makeRequest('uuid-6', { 'x-payment-proof': 'not-json!!!' });
    const res = await GET(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid');
  });
});
