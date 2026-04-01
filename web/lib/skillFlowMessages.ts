import {
  getConfiguredSolanaChainDisplayLabel,
  getConfiguredSolanaRpcTargetLabel,
} from "@/lib/chains";

export function getConfiguredSkillFlowNetworkDescription(): string {
  return `${getConfiguredSolanaChainDisplayLabel()} (${getConfiguredSolanaRpcTargetLabel()} RPC)`;
}

export function buildPaidSkillDownloadRequiredMessage(): string {
  return `This paid skill is not unlocked for your connected wallet on the configured ${getConfiguredSkillFlowNetworkDescription()}. Buy it on this network or switch Phantom and the app to the same cluster, then retry.`;
}

export function buildSignedDownloadErrorMessage(
  error: string | null | undefined,
  message?: string | null
): string {
  const normalizedError = error?.trim() || null;
  const normalizedMessage = message?.trim() || null;
  const combined = `${normalizedError ?? ""} ${normalizedMessage ?? ""}`.trim();

  if (
    /payment required/i.test(combined) ||
    /purchaseskill on-chain/i.test(combined)
  ) {
    return buildPaidSkillDownloadRequiredMessage();
  }

  return normalizedError || normalizedMessage || "Signed download failed";
}
