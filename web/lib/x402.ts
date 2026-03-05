import { createHash, randomBytes } from 'crypto';

export interface PaymentRequirement {
  scheme: 'exact';
  network: 'solana';
  mint: string;
  amount: number;
  recipient: string;
  resource: string;
  expiry: number;
  nonce: string;
  metadata?: Record<string, string>;
}

export interface PaymentProof {
  txSignature: string;
  requirement: PaymentRequirement;
}

const SOL_NATIVE_MINT = 'So11111111111111111111111111111111111111112';
const SETTLEMENT_CACHE = new Map<string, { status: string; settledAt: number }>();

export function generatePaymentRequirement(opts: {
  skillId: string;
  priceLamports: number;
  authorPubkey: string;
  resourcePath: string;
}): PaymentRequirement {
  const expirySeconds = 300;
  return {
    scheme: 'exact',
    network: 'solana',
    mint: SOL_NATIVE_MINT,
    amount: opts.priceLamports,
    recipient: opts.authorPubkey,
    resource: hashResource(opts.resourcePath),
    expiry: Math.floor(Date.now() / 1000) + expirySeconds,
    nonce: randomBytes(16).toString('hex'),
    metadata: {
      skill_id: opts.skillId,
      display_price: `${(opts.priceLamports / 1e9).toFixed(4)} SOL`,
    },
  };
}

export function hashResource(resource: string): string {
  return createHash('sha256').update(resource).digest('hex').slice(0, 32);
}

export function paymentRefFromProof(proof: PaymentProof): string {
  return createHash('sha256')
    .update(`${proof.txSignature}:${proof.requirement.resource}:${proof.requirement.nonce}`)
    .digest('hex');
}

export async function verifyPaymentProof(proof: PaymentProof): Promise<{
  status: 'valid' | 'invalid' | 'pending';
  paymentRef: string;
  error?: string;
}> {
  const paymentRef = paymentRefFromProof(proof);

  const existing = SETTLEMENT_CACHE.get(paymentRef);
  if (existing) {
    return { status: 'valid', paymentRef };
  }

  const { requirement } = proof;

  if (requirement.scheme !== 'exact') {
    return { status: 'invalid', paymentRef, error: 'Unsupported payment scheme' };
  }

  if (requirement.network !== 'solana') {
    return { status: 'invalid', paymentRef, error: 'Unsupported network' };
  }

  if (requirement.expiry < Math.floor(Date.now() / 1000)) {
    return { status: 'invalid', paymentRef, error: 'Payment requirement expired' };
  }

  if (!proof.txSignature || proof.txSignature.length < 32) {
    return { status: 'invalid', paymentRef, error: 'Invalid transaction signature' };
  }

  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [proof.txSignature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
      }),
    });

    const result = await response.json();

    if (!result.result || result.result.meta?.err) {
      return { status: 'invalid', paymentRef, error: 'Transaction failed or not found' };
    }

    return { status: 'valid', paymentRef };
  } catch (err: any) {
    return { status: 'pending', paymentRef, error: `Verification pending: ${err.message}` };
  }
}

export async function settlePayment(proof: PaymentProof): Promise<{
  settlementId: string;
  status: 'complete' | 'pending' | 'failed';
}> {
  const paymentRef = paymentRefFromProof(proof);

  const existing = SETTLEMENT_CACHE.get(paymentRef);
  if (existing) {
    return { settlementId: paymentRef, status: existing.status as any };
  }

  const verification = await verifyPaymentProof(proof);

  if (verification.status === 'valid') {
    SETTLEMENT_CACHE.set(paymentRef, { status: 'complete', settledAt: Date.now() });
    return { settlementId: paymentRef, status: 'complete' };
  }

  if (verification.status === 'pending') {
    SETTLEMENT_CACHE.set(paymentRef, { status: 'pending', settledAt: Date.now() });
    return { settlementId: paymentRef, status: 'pending' };
  }

  return { settlementId: paymentRef, status: 'failed' };
}
