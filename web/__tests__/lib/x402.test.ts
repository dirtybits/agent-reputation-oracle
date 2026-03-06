import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generatePaymentRequirement,
  hashResource,
  paymentRefFromProof,
  verifyPaymentProof,
  settlePayment,
  type PaymentRequirement,
  type PaymentProof,
} from '@/lib/x402';

function makeRequirement(overrides: Partial<PaymentRequirement> = {}): PaymentRequirement {
  return {
    scheme: 'exact',
    network: 'solana',
    mint: 'So11111111111111111111111111111111111111112',
    amount: 100_000_000,
    recipient: 'AuthorPubkey123456789012345678901234567890',
    resource: hashResource('/api/skills/abc/raw'),
    expiry: Math.floor(Date.now() / 1000) + 300,
    nonce: 'abcdef1234567890abcdef1234567890',
    ...overrides,
  };
}

function makeProof(overrides: Partial<PaymentProof> = {}): PaymentProof {
  return {
    txSignature: 'a'.repeat(88),
    requirement: makeRequirement(),
    ...overrides,
  };
}

describe('generatePaymentRequirement', () => {
  it('returns correct structure with all fields', () => {
    const req = generatePaymentRequirement({
      skillId: 'test-skill',
      priceLamports: 50_000_000,
      authorPubkey: 'AuthorKey',
      resourcePath: '/api/skills/123/raw',
    });

    expect(req.scheme).toBe('exact');
    expect(req.network).toBe('solana');
    expect(req.mint).toBe('So11111111111111111111111111111111111111112');
    expect(req.amount).toBe(50_000_000);
    expect(req.recipient).toBe('AuthorKey');
    expect(req.nonce).toHaveLength(32);
    expect(req.metadata?.skill_id).toBe('test-skill');
    expect(req.metadata?.display_price).toBe('0.0500 SOL');
  });

  it('sets expiry ~5 minutes in the future', () => {
    const before = Math.floor(Date.now() / 1000);
    const req = generatePaymentRequirement({
      skillId: 'x',
      priceLamports: 1,
      authorPubkey: 'x',
      resourcePath: '/x',
    });
    const after = Math.floor(Date.now() / 1000);

    expect(req.expiry).toBeGreaterThanOrEqual(before + 299);
    expect(req.expiry).toBeLessThanOrEqual(after + 301);
  });

  it('generates unique nonces per call', () => {
    const opts = { skillId: 'x', priceLamports: 1, authorPubkey: 'x', resourcePath: '/x' };
    const a = generatePaymentRequirement(opts);
    const b = generatePaymentRequirement(opts);
    expect(a.nonce).not.toBe(b.nonce);
  });
});

describe('hashResource', () => {
  it('is deterministic', () => {
    expect(hashResource('/api/skills/1/raw')).toBe(hashResource('/api/skills/1/raw'));
  });

  it('returns 32-char hex string', () => {
    const h = hashResource('/some/path');
    expect(h).toHaveLength(32);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });

  it('differs for different paths', () => {
    expect(hashResource('/a')).not.toBe(hashResource('/b'));
  });
});

describe('paymentRefFromProof', () => {
  it('is deterministic for same proof', () => {
    const proof = makeProof();
    expect(paymentRefFromProof(proof)).toBe(paymentRefFromProof(proof));
  });

  it('differs when txSignature changes', () => {
    const a = makeProof({ txSignature: 'a'.repeat(88) });
    const b = makeProof({ txSignature: 'b'.repeat(88) });
    expect(paymentRefFromProof(a)).not.toBe(paymentRefFromProof(b));
  });

  it('differs when nonce changes', () => {
    const req1 = makeRequirement({ nonce: '1'.repeat(32) });
    const req2 = makeRequirement({ nonce: '2'.repeat(32) });
    const a = makeProof({ requirement: req1 });
    const b = makeProof({ requirement: req2 });
    expect(paymentRefFromProof(a)).not.toBe(paymentRefFromProof(b));
  });
});

describe('verifyPaymentProof', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unsupported scheme', async () => {
    const proof = makeProof({
      requirement: makeRequirement({ scheme: 'other' as any }),
    });
    const result = await verifyPaymentProof(proof);
    expect(result.status).toBe('invalid');
    expect(result.error).toContain('scheme');
  });

  it('rejects unsupported network', async () => {
    const proof = makeProof({
      requirement: makeRequirement({ network: 'ethereum' as any }),
    });
    const result = await verifyPaymentProof(proof);
    expect(result.status).toBe('invalid');
    expect(result.error).toContain('network');
  });

  it('rejects expired requirement', async () => {
    const proof = makeProof({
      requirement: makeRequirement({ expiry: Math.floor(Date.now() / 1000) - 10 }),
    });
    const result = await verifyPaymentProof(proof);
    expect(result.status).toBe('invalid');
    expect(result.error).toContain('expired');
  });

  it('rejects short tx signature', async () => {
    const proof = makeProof({ txSignature: 'tooshort' });
    const result = await verifyPaymentProof(proof);
    expect(result.status).toBe('invalid');
    expect(result.error).toContain('signature');
  });

  it('returns valid when RPC confirms tx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ result: { meta: { err: null } } }),
    }));

    const proof = makeProof();
    const result = await verifyPaymentProof(proof);
    expect(result.status).toBe('valid');
  });

  it('returns invalid when tx not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ result: null }),
    }));

    const proof = makeProof();
    const result = await verifyPaymentProof(proof);
    expect(result.status).toBe('invalid');
    expect(result.error).toContain('not found');
  });

  it('returns invalid when tx has error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ result: { meta: { err: 'InstructionError' } } }),
    }));

    const proof = makeProof();
    const result = await verifyPaymentProof(proof);
    expect(result.status).toBe('invalid');
  });

  it('returns pending when RPC fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    const proof = makeProof();
    const result = await verifyPaymentProof(proof);
    expect(result.status).toBe('pending');
    expect(result.error).toContain('network error');
  });
});

describe('settlePayment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns failed for invalid proof', async () => {
    const proof = makeProof({ txSignature: 'bad' });
    const result = await settlePayment(proof);
    expect(result.status).toBe('failed');
  });

  it('returns complete for valid proof', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ result: { meta: { err: null } } }),
    }));

    const proof = makeProof();
    const result = await settlePayment(proof);
    expect(result.status).toBe('complete');
    expect(result.settlementId).toBeTruthy();
  });
});
