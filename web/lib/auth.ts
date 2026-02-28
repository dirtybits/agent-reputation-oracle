import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';

const NONCE_WINDOW_MS = 5 * 60_000; // 5 minutes

export interface AuthPayload {
  pubkey: string;
  signature: string; // base64
  message: string;   // the signed message string
  timestamp: number; // unix ms included in message
}

export function verifyWalletSignature(payload: AuthPayload): {
  valid: boolean;
  pubkey: string | null;
  error?: string;
} {
  try {
    const { pubkey, signature, message, timestamp } = payload;

    const age = Date.now() - timestamp;
    if (age > NONCE_WINDOW_MS || age < -NONCE_WINDOW_MS) {
      return { valid: false, pubkey: null, error: 'Signature expired' };
    }

    const publicKey = new PublicKey(pubkey);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Uint8Array.from(Buffer.from(signature, 'base64'));

    const verified = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );

    if (!verified) {
      return { valid: false, pubkey: null, error: 'Invalid signature' };
    }

    return { valid: true, pubkey };
  } catch (err: any) {
    return { valid: false, pubkey: null, error: err.message };
  }
}

export function buildSignMessage(action: string, timestamp: number): string {
  return `AgentVouch Skill Repo\nAction: ${action}\nTimestamp: ${timestamp}`;
}
