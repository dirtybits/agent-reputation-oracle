import { createHash, randomBytes } from 'crypto';
import {
  createSolanaRpc,
  getProgramDerivedAddress,
  getAddressEncoder,
  getUtf8Encoder,
  type Address,
} from '@solana/kit';
import {
  fetchMaybePurchase,
} from '../generated/reputation-oracle/src/generated';
import { REPUTATION_ORACLE_PROGRAM_ADDRESS } from '../generated/reputation-oracle/src/generated/programs';

const SOL_NATIVE_MINT = 'So11111111111111111111111111111111111111112';
const VERIFICATION_CACHE = new Map<string, { status: string; verifiedAt: number }>();

export interface PaymentRequirement {
  scheme: 'exact';
  network: 'solana';
  programId: string;
  instruction: 'purchaseSkill';
  skillListingAddress: string;
  mint: string;
  amount: number;
  resource: string;
  expiry: number;
  nonce: string;
  metadata?: Record<string, string>;
}

export interface PaymentProof {
  buyer: string;
  txSignature: string;
  requirement: PaymentRequirement;
}

export function generatePaymentRequirement(opts: {
  skillId: string;
  priceLamports: number;
  skillListingAddress: string;
  resourcePath: string;
}): PaymentRequirement {
  const expirySeconds = 300;
  return {
    scheme: 'exact',
    network: 'solana',
    programId: REPUTATION_ORACLE_PROGRAM_ADDRESS,
    instruction: 'purchaseSkill',
    skillListingAddress: opts.skillListingAddress,
    mint: SOL_NATIVE_MINT,
    amount: opts.priceLamports,
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
    .update(`${proof.buyer}:${proof.requirement.skillListingAddress}:${proof.requirement.nonce}`)
    .digest('hex');
}

async function derivePurchasePda(
  buyer: string,
  skillListingAddress: string,
): Promise<Address> {
  const addressEncoder = getAddressEncoder();
  const utf8Encoder = getUtf8Encoder();

  const [pda] = await getProgramDerivedAddress({
    programAddress: REPUTATION_ORACLE_PROGRAM_ADDRESS,
    seeds: [
      utf8Encoder.encode('purchase'),
      addressEncoder.encode(buyer as Address),
      addressEncoder.encode(skillListingAddress as Address),
    ],
  });

  return pda;
}

export async function verifyPaymentProof(proof: PaymentProof): Promise<{
  status: 'valid' | 'invalid' | 'pending';
  paymentRef: string;
  error?: string;
}> {
  const paymentRef = paymentRefFromProof(proof);

  const existing = VERIFICATION_CACHE.get(paymentRef);
  if (existing?.status === 'valid' || existing?.status === 'complete') {
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

  if (!proof.buyer || proof.buyer.length < 32) {
    return { status: 'invalid', paymentRef, error: 'Missing or invalid buyer address' };
  }

  try {
    const purchasePda = await derivePurchasePda(
      proof.buyer,
      requirement.skillListingAddress,
    );

    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const rpc = createSolanaRpc(rpcUrl);
    const account = await fetchMaybePurchase(rpc, purchasePda);

    if (!account.exists) {
      return { status: 'invalid', paymentRef, error: 'Purchase not found on-chain. Call purchaseSkill first.' };
    }

    if (account.data.buyer !== proof.buyer) {
      return { status: 'invalid', paymentRef, error: 'Purchase buyer mismatch' };
    }

    VERIFICATION_CACHE.set(paymentRef, { status: 'valid', verifiedAt: Date.now() });
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

  const existing = VERIFICATION_CACHE.get(paymentRef);
  if (existing?.status === 'complete' || existing?.status === 'valid') {
    return { settlementId: paymentRef, status: 'complete' };
  }

  const verification = await verifyPaymentProof(proof);

  if (verification.status === 'valid') {
    VERIFICATION_CACHE.set(paymentRef, { status: 'complete', verifiedAt: Date.now() });
    return { settlementId: paymentRef, status: 'complete' };
  }

  if (verification.status === 'pending') {
    return { settlementId: paymentRef, status: 'pending' };
  }

  return { settlementId: paymentRef, status: 'failed' };
}
