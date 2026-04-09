import type { SkillListResponse, SkillRecord } from "./http.js";

function getTrustFields(skill: SkillRecord) {
  return {
    reputation:
      skill.author_trust_summary?.reputationScore ??
      skill.author_trust?.reputationScore ??
      0,
    isRegistered:
      skill.author_trust_summary?.isRegistered ??
      skill.author_trust?.isRegistered ??
      false,
    recommendedAction: skill.author_trust_summary?.recommended_action ?? null,
    activeDisputes:
      skill.author_trust_summary?.activeDisputesAgainstAuthor ??
      skill.author_trust?.activeDisputesAgainstAuthor ??
      0,
    upheldDisputes:
      skill.author_trust_summary?.disputesUpheldAgainstAuthor ??
      skill.author_trust?.disputesUpheldAgainstAuthor ??
      0,
  };
}

export function formatSkillSummary(skill: SkillRecord): string[] {
  const trust = getTrustFields(skill);

  return [
    `${skill.name}`,
    `id: ${skill.id}`,
    `skill_id: ${skill.skill_id}`,
    `source: ${skill.source ?? "repo"}`,
    `author: ${skill.author_pubkey}`,
    `author_reputation: ${trust.reputation}`,
    `price_lamports: ${skill.price_lamports ?? 0}`,
    `listing: ${skill.on_chain_address ?? "none"}`,
    `registered: ${trust.isRegistered ? "yes" : "no"}`,
    ...(trust.recommendedAction
      ? [`recommended_action: ${trust.recommendedAction}`]
      : []),
    `active_author_disputes: ${trust.activeDisputes}`,
    `upheld_author_disputes: ${trust.upheldDisputes}`,
  ];
}

export function formatSkillList(result: SkillListResponse): string[] {
  if (result.skills.length === 0) {
    return [
      "no skills found",
      `page: ${result.pagination.page}`,
      `page_size: ${result.pagination.pageSize}`,
      `total: ${result.pagination.total}`,
      `total_pages: ${result.pagination.totalPages}`,
    ];
  }

  const lines: string[] = [];

  for (const [index, skill] of result.skills.entries()) {
    lines.push(...formatSkillSummary(skill));
    if (index < result.skills.length - 1) {
      lines.push("");
    }
  }

  lines.push(
    "",
    `page: ${result.pagination.page}`,
    `page_size: ${result.pagination.pageSize}`,
    `total: ${result.pagination.total}`,
    `total_pages: ${result.pagination.totalPages}`
  );

  return lines;
}
