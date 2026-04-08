"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiDownload,
  FiExternalLink,
  FiShield,
  FiTag,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import { LiaCoinsSolid } from "react-icons/lia";
import { SolAmount } from "@/components/SolAmount";
import {
  getAuthorReportStatus,
  type TrustData,
} from "@/components/TrustBadge";
import {
  navButtonFlexClass,
  navButtonPrimaryFlexClass,
  navButtonSizeClass,
} from "@/lib/buttonStyles";
import { formatSolAmount } from "@/lib/pricing";
import type { PurchasePreflightStatus } from "@/lib/purchasePreflight";

interface SkillPreviewCardSkill {
  id: string;
  author_pubkey: string;
  name: string;
  description: string | null;
  tags: string[];
  current_version: number;
  source?: "repo" | "chain";
  author_trust: TrustData | null;
  purchasePreflightMessage?: string | null;
  purchaseBlockError?: {
    code: "buyerInsufficientBalance" | "authorPayoutRentBlocked";
    message: string;
  } | null;
}

interface SkillPreviewCardProps {
  skill: SkillPreviewCardSkill;
  hasListing: boolean;
  creatorPriceLamports: number;
  estimatedTotalLamports: number;
  downloads: number;
  connected: boolean;
  isOwn: boolean;
  hasPurchased: boolean;
  isPurchasing: boolean;
  purchaseBlocked: boolean;
  purchasePreflightStatus?: PurchasePreflightStatus;
  descriptionFallback?: string | null;
  onPurchase: () => void;
}

interface MetricCellProps {
  label: string;
  value: string;
  title: string;
  tone?: "default" | "positive" | "warning" | "danger" | "accent";
  icon: React.ComponentType<{ className?: string }>;
}

function truncateAtWord(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  const candidate = value.slice(0, maxChars + 1).trimEnd();
  const lastBoundary = candidate.lastIndexOf(" ");
  const trimmed =
    lastBoundary >= Math.floor(maxChars * 0.6)
      ? candidate.slice(0, lastBoundary)
      : candidate.slice(0, maxChars);

  return `${trimmed.trimEnd()}...`;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatSol(lamports: number): string {
  return `${formatSolAmount(lamports)} SOL`;
}

function getToneClass(tone: MetricCellProps["tone"] = "default"): string {
  switch (tone) {
    case "positive":
      return "text-green-700 dark:text-green-400";
    case "warning":
      return "text-amber-700 dark:text-amber-300";
    case "danger":
      return "text-red-700 dark:text-red-400";
    case "accent":
      return "text-[var(--lobster-accent-strong)]";
    default:
      return "text-gray-900 dark:text-white";
  }
}

function MetricCell({
  label,
  value,
  title,
  tone = "default",
  icon: Icon,
}: MetricCellProps) {
  return (
    <div
      className="rounded-sm border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50 px-3 py-2"
      title={title}
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className={`mt-1 text-sm font-semibold ${getToneClass(tone)}`}>
        {value}
      </div>
    </div>
  );
}

export default function SkillPreviewCard({
  skill,
  hasListing,
  creatorPriceLamports,
  estimatedTotalLamports,
  downloads,
  connected,
  isOwn,
  hasPurchased,
  isPurchasing,
  purchaseBlocked,
  purchasePreflightStatus,
  descriptionFallback,
  onPurchase,
}: SkillPreviewCardProps) {
  const [showPurchaseWarning, setShowPurchaseWarning] = useState(false);
  const displayTitle = truncateAtWord(skill.name, 32);
  const description = skill.description ?? descriptionFallback ?? "";
  const displayDescription = description
    ? truncateAtWord(description, 64)
    : null;
  const trust = skill.author_trust;
  const authorReports = trust
    ? getAuthorReportStatus(
        trust.disputesAgainstAuthor,
        trust.disputesUpheldAgainstAuthor,
        trust.activeDisputesAgainstAuthor
      )
    : null;
  const priceTooltip =
    creatorPriceLamports > 0
      ? estimatedTotalLamports === creatorPriceLamports
        ? "Estimated buyer total for this paid skill."
        : `Estimated buyer total includes network rent. Creator price: ${formatSol(
            creatorPriceLamports
          )}.`
      : "No on-chain purchase required.";
  const purchaseWarning =
    purchaseBlocked
      ? skill.purchaseBlockError?.message ?? skill.purchasePreflightMessage
      : null;
  const purchaseWarningId = `purchase-warning-${skill.id}`;

  return (
    <div className="group flex flex-col rounded-sm border border-gray-200 bg-white p-4 transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      <div className="flex-1">
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <Link
              href={`/skills/${skill.id}`}
              className="block truncate font-heading text-base font-bold text-gray-900 transition group-hover:text-[var(--lobster-accent)] hover:underline dark:text-white"
              title={skill.name}
            >
              {displayTitle}
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {skill.source !== "chain" && (
              <span
                className="rounded-sm border border-[var(--sea-accent-border)] bg-[var(--sea-accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--sea-accent-strong)]"
                title={`Current repo version: v${skill.current_version}`}
              >
                v{skill.current_version}
              </span>
            )}
            {creatorPriceLamports > 0 ? (
              <span
                className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400"
                title={priceTooltip}
              >
                <SolAmount
                  amount={formatSolAmount(estimatedTotalLamports)}
                  iconClassName="h-3 w-3"
                />
              </span>
            ) : hasListing ? (
              <span
                className="rounded-full bg-[var(--sea-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--sea-accent-strong)]"
                title={priceTooltip}
              >
                Free
              </span>
            ) : null}
          </div>
        </div>

        {displayDescription && (
          <p
            className="mb-3 min-h-[2.5rem] text-sm leading-5 text-gray-500 dark:text-gray-400"
            title={description}
          >
            {displayDescription}
          </p>
        )}

        <Link
          href={`/author/${skill.author_pubkey}`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition hover:text-[var(--sea-accent)] hover:underline dark:text-gray-400"
          title="Author wallet that published this skill and receives creator proceeds."
        >
          <FiUser className="h-3.5 w-3.5" />
          <span className="font-mono">{shortAddr(skill.author_pubkey)}</span>
          <FiExternalLink className="h-3 w-3" />
        </Link>

        {trust && trust.isRegistered ? (
          <div className="grid grid-cols-2 gap-2">
            <MetricCell
              label="Reputation"
              value={trust.reputationScore.toLocaleString("en-US")}
              title="Reputation combines public backing, endorsements, and dispute history for the author."
              tone="positive"
              icon={FiShield}
            />
            <MetricCell
              label="Vouches"
              value={trust.totalVouchesReceived.toLocaleString("en-US")}
              title="Vouches are outside endorsements staked behind the author."
              tone="accent"
              icon={FiUsers}
            />
            <MetricCell
              label="Disputes"
              value={authorReports?.label ?? "Clean"}
              title="Disputes show the author's current and historical challenge status."
              tone={
                trust.activeDisputesAgainstAuthor > 0
                  ? "danger"
                  : trust.disputesUpheldAgainstAuthor > 0
                    ? "warning"
                    : "positive"
              }
              icon={FiAlertTriangle}
            />
            <MetricCell
              label="Backing"
              value={formatSol(trust.totalStakedFor)}
              title="Backing is the total outside stake currently supporting this author."
              icon={LiaCoinsSolid}
            />
            <MetricCell
              label="Self stake"
              value={formatSol(trust.authorBondLamports)}
              title="Self stake is the author's own first-loss capital."
              icon={FiUser}
            />
            <MetricCell
              label="Downloads"
              value={downloads.toLocaleString("en-US")}
              title="Downloads include successful installs and raw file downloads."
              icon={FiDownload}
            />
          </div>
        ) : (
          <div className="rounded-sm border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <FiShield className="h-3.5 w-3.5" />
              <span title="This author has no registered on-chain trust profile yet.">
                Unregistered author
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
              <FiDownload className="h-3.5 w-3.5" />
              <span>{downloads.toLocaleString("en-US")} downloads</span>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {skill.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                title="Tags summarize the skill's core capabilities."
              >
                <FiTag className="h-3 w-3" />
                {tag}
              </span>
            ))}
          </div>
          <Link
            href={`/author/${skill.author_pubkey}`}
            className="shrink-0 text-[11px] font-medium text-[var(--sea-accent)] transition hover:text-[var(--sea-accent-strong)] hover:underline"
            title={skill.author_pubkey}
          >
            Trust details
          </Link>
        </div>
      </div>

      {hasListing && (
        <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
          {isOwn ? (
            <div
              className={`w-full border border-gray-200 bg-gray-50 text-center font-medium text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500 ${navButtonSizeClass}`}
            >
              Your Skill
            </div>
          ) : creatorPriceLamports === 0 ? (
            <Link
              href={`/skills/${skill.id}`}
              className={`w-full border border-[var(--sea-accent-border)] bg-[var(--sea-accent-soft)] text-center font-medium text-[var(--sea-accent-strong)] transition hover:bg-[var(--sea-accent-soft-hover)] ${navButtonFlexClass}`}
            >
              <FiDownload className="h-3 w-3" />
              Free - View & Install
            </Link>
          ) : hasPurchased ? (
            <div
              className={`w-full border border-green-200 bg-green-50 text-center font-medium text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400 ${navButtonSizeClass}`}
            >
              <span className="inline-flex items-center gap-1">
                <FiCheckCircle className="h-3 w-3" />
                Purchased
              </span>
            </div>
          ) : purchaseBlocked ? (
            <div
              className="relative"
              onMouseEnter={() => setShowPurchaseWarning(true)}
              onMouseLeave={() => setShowPurchaseWarning(false)}
            >
              <button
                type="button"
                onClick={() => setShowPurchaseWarning((visible) => !visible)}
                onFocus={() => setShowPurchaseWarning(true)}
                onBlur={() => setShowPurchaseWarning(false)}
                aria-describedby={purchaseWarning ? purchaseWarningId : undefined}
                aria-expanded={purchaseWarning ? showPurchaseWarning : undefined}
                className={`w-full cursor-help border border-amber-200 bg-amber-50 text-center font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300 ${navButtonSizeClass}`}
              >
                {purchasePreflightStatus === "authorPayoutRentBlocked"
                  ? "Seller Needs SOL"
                  : "Need More SOL"}
              </button>
              {purchaseWarning && (
                <div
                  id={purchaseWarningId}
                  role="tooltip"
                  className={`pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-sm border border-amber-200 bg-white px-3 py-2 text-left text-[11px] leading-relaxed text-amber-700 shadow-lg transition dark:border-amber-800 dark:bg-gray-950 dark:text-amber-300 ${
                    showPurchaseWarning
                      ? "visible opacity-100"
                      : "invisible opacity-0"
                  }`}
                >
                  {purchaseWarning}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onPurchase}
              disabled={!connected || isPurchasing}
              className={`w-full ${navButtonPrimaryFlexClass}`}
            >
              {isPurchasing ? (
                <span className="animate-pulse">Processing...</span>
              ) : connected ? (
                "Buy Skill"
              ) : (
                "Connect Wallet to Buy"
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
