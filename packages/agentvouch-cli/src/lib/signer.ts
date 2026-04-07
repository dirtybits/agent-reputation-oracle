import {
  buildDownloadRawMessage,
  buildSignMessage,
  type AuthPayload,
} from "@agentvouch/protocol";
import { readFileSync } from "node:fs";
import nacl from "tweetnacl";
import { Keypair } from "@solana/web3.js";
import { CliError } from "./errors.js";

function encodeBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export function loadKeypair(keypairPath: string): Keypair {
  try {
    const secret = JSON.parse(readFileSync(keypairPath, "utf8")) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  } catch (error) {
    throw new CliError(
      `Failed to read keypair at ${keypairPath}: ${error instanceof Error ? error.message : "invalid keypair file"}`
    );
  }
}

export function signUtf8Message(keypair: Keypair, message: string): string {
  const signature = nacl.sign.detached(
    new TextEncoder().encode(message),
    keypair.secretKey
  );
  return encodeBase64(signature);
}

export function createRepoAuthPayload(
  keypair: Keypair,
  action: string,
  timestamp = Date.now()
): AuthPayload {
  const message = buildSignMessage(action, timestamp);
  return {
    pubkey: keypair.publicKey.toBase58(),
    signature: signUtf8Message(keypair, message),
    message,
    timestamp,
  };
}

export function createDownloadAuthPayload(
  keypair: Keypair,
  skillId: string,
  listingAddress: string,
  timestamp = Date.now()
): AuthPayload {
  const message = buildDownloadRawMessage(skillId, listingAddress, timestamp);
  return {
    pubkey: keypair.publicKey.toBase58(),
    signature: signUtf8Message(keypair, message),
    message,
    timestamp,
  };
}
