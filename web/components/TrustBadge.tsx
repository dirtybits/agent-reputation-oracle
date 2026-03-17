'use client';

import { FiShield, FiUsers, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { formatSolAmount } from '@/lib/pricing';

export interface TrustData {
  reputationScore: number;
  totalVouchesReceived: number;
  totalStakedFor: number;
  disputesWon: number;
  disputesLost: number;
  registeredAt: number;
  isRegistered: boolean;
}

interface TrustBadgeProps {
  trust: TrustData | null;
  compact?: boolean;
}

function formatSol(lamports: number): string {
  return formatSolAmount(lamports);
}

function getDisputeStatus(won: number, lost: number): { label: string; color: string } {
  if (won === 0 && lost === 0) return { label: 'Clean', color: 'text-green-600 dark:text-green-400' };
  if (lost === 0) return { label: `${won} resolved`, color: 'text-green-600 dark:text-green-400' };
  return { label: `${won}W / ${lost}L`, color: 'text-yellow-600 dark:text-yellow-400' };
}

export default function TrustBadge({ trust, compact = false }: TrustBadgeProps) {
  if (!trust || !trust.isRegistered) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
        <FiShield className="w-3 h-3" />
        Unregistered
      </span>
    );
  }

  const dispute = getDisputeStatus(trust.disputesWon, trust.disputesLost);

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-semibold">
          <FiShield className="w-3.5 h-3.5" />
          {trust.reputationScore}
        </span>
        <span className="flex items-center gap-1 text-[var(--lobster-accent)]">
          <FiUsers className="w-3.5 h-3.5" />
          {trust.totalVouchesReceived}
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          {formatSol(trust.totalStakedFor)} SOL
        </span>
        <span className={`flex items-center gap-1 ${dispute.color}`}>
          {trust.disputesLost > 0 ? <FiAlertTriangle className="w-3.5 h-3.5" /> : <FiCheckCircle className="w-3.5 h-3.5" />}
          {dispute.label}
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-center">
        <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400 mb-1">
          <FiShield className="w-4 h-4" />
        </div>
        <div className="text-lg font-bold">{trust.reputationScore}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Reputation</div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-center">
        <div className="flex items-center justify-center gap-1 text-[var(--lobster-accent)] mb-1">
          <FiUsers className="w-4 h-4" />
        </div>
        <div className="text-lg font-bold">{trust.totalVouchesReceived}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Vouches</div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-center">
        <div className="text-lg font-bold">{formatSol(trust.totalStakedFor)}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">SOL Staked</div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-center">
        <div className={`flex items-center justify-center gap-1 ${dispute.color} mb-1`}>
          {trust.disputesLost > 0 ? <FiAlertTriangle className="w-4 h-4" /> : <FiCheckCircle className="w-4 h-4" />}
        </div>
        <div className="text-sm font-bold">{dispute.label}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Disputes</div>
      </div>
    </div>
  );
}
