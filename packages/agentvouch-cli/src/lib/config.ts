import {
  AGENTVOUCH_DEFAULT_BASE_URL,
  AGENTVOUCH_DEFAULT_RPC_URL,
} from "@agentvouch/protocol";

export function resolveBaseUrl(baseUrl?: string): string {
  return (
    baseUrl ||
    process.env.AGENTVOUCH_BASE_URL ||
    AGENTVOUCH_DEFAULT_BASE_URL
  )
    .trim()
    .replace(/\/+$/, "");
}

export function resolveRpcUrl(rpcUrl?: string): string {
  return (
    rpcUrl ||
    process.env.AGENTVOUCH_RPC_URL ||
    process.env.ANCHOR_PROVIDER_URL ||
    AGENTVOUCH_DEFAULT_RPC_URL
  ).trim();
}
