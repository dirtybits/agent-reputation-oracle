'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useWalletConnection } from '@solana/react-hooks';
import { address, type Address } from '@solana/kit';
import Link from 'next/link';
import { useReputationOracle } from '@/hooks/useReputationOracle';
import TrustBadge, { type TrustData } from '@/components/TrustBadge';
import {
  FiArrowLeft,
  FiCalendar,
  FiCheckCircle,
  FiCopy,
  FiCheck,
  FiDollarSign,
  FiDownload,
  FiExternalLink,
  FiPackage,
  FiShield,
  FiTag,
  FiTrendingUp,
  FiUsers,
  FiZap,
} from 'react-icons/fi';

const LAMPORTS_PER_SOL = 1_000_000_000;

function shortAddr(addr: string): string {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function formatSol(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(2);
}

function formatDate(isoOrTimestamp: string | number): string {
  const d = typeof isoOrTimestamp === 'number'
    ? new Date(isoOrTimestamp * 1000)
    : new Date(isoOrTimestamp);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

interface RepoSkill {
  id: string;
  skill_id: string;
  author_pubkey: string;
  name: string;
  description: string | null;
  tags: string[];
  current_version: number;
  ipfs_cid: string | null;
  total_installs: number;
  total_downloads?: number;
  price_lamports?: number;
  on_chain_address?: string;
  source?: 'repo' | 'chain';
  created_at: string;
  author_trust: TrustData | null;
}

export default function AuthorProfilePage() {
  const params = useParams();
  const pubkey = params.pubkey as string;

  const { wallet, status: walletStatus } = useWalletConnection();
  const connected = walletStatus === 'connected' && !!wallet;
  const myPubkey = wallet?.account.address ?? null;
  const oracle = useReputationOracle();

  const [profile, setProfile] = useState<any>(null);
  const [vouchesReceived, setVouchesReceived] = useState<any[]>([]);
  const [vouchesGiven, setVouchesGiven] = useState<any[]>([]);
  const [repoSkills, setRepoSkills] = useState<RepoSkill[]>([]);
  const [chainSkills, setChainSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [vouchAmount, setVouchAmount] = useState('0.1');
  const [vouching, setVouching] = useState(false);
  const [vouchStatus, setVouchStatus] = useState('');
  const [myProfile, setMyProfile] = useState<any>(null);

  const isOwnProfile = myPubkey === pubkey;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const agentAddr = address(pubkey);
      const [prof, received, given, chainListings, repoRes] = await Promise.all([
        oracle.getAgentProfile(agentAddr).catch(() => null),
        oracle.getAllVouchesReceivedByAgent(agentAddr).catch(() => []),
        oracle.getAllVouchesForAgent(agentAddr).catch(() => []),
        oracle.getSkillListingsByAuthor(agentAddr).catch(() => []),
        fetch(`/api/skills?author=${pubkey}`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      setProfile(prof);
      setVouchesReceived(received);
      setVouchesGiven(given);
      setChainSkills(chainListings);
      setRepoSkills(repoRes?.skills ?? []);
    } catch (e) {
      console.error('Failed to load author profile:', e);
    } finally {
      setLoading(false);
    }
    // oracle is intentionally omitted — it changes reference every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (connected && myPubkey && !isOwnProfile) {
      oracle.getAgentProfile(address(myPubkey)).then(setMyProfile).catch(() => null);
    }
    // oracle is intentionally omitted — it changes reference every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, myPubkey, isOwnProfile]);

  const copyPubkey = () => {
    navigator.clipboard.writeText(pubkey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVouch = async () => {
    if (!connected || !myProfile) return;
    setVouching(true);
    setVouchStatus('Creating vouch...');
    try {
      const { tx } = await oracle.vouch(address(pubkey), parseFloat(vouchAmount));
      setVouchStatus(`Vouch created! TX: ${tx.slice(0, 16)}...`);
      setTimeout(loadData, 2000);
    } catch (error: any) {
      setVouchStatus(`Error: ${error.message}`);
    } finally {
      setVouching(false);
    }
  };

  const totalOnChainDownloads = chainSkills.reduce(
    (sum, s) => sum + Number(s.account.totalDownloads ?? 0), 0
  );
  const totalRepoInstalls = repoSkills.reduce(
    (sum, s) => sum + (s.total_installs ?? 0) + (s.total_downloads ?? 0), 0
  );
  const totalDownloads = totalOnChainDownloads + totalRepoInstalls;
  const totalRevenue = chainSkills.reduce(
    (sum, s) => sum + Number(s.account.totalRevenue ?? 0), 0
  );
  const skillsPublished = chainSkills.length + repoSkills.filter(
    s => !s.on_chain_address || !chainSkills.some(c => c.publicKey === s.on_chain_address)
  ).length;

  const trustData: TrustData | null = profile ? {
    reputationScore: Number(profile.reputationScore ?? 0),
    totalVouchesReceived: Number(profile.totalVouchesReceived ?? 0),
    totalStakedFor: Number(profile.totalStakedFor ?? 0),
    disputesWon: Number(profile.disputesWon ?? 0),
    disputesLost: Number(profile.disputesLost ?? 0),
    registeredAt: Number(profile.registeredAt ?? 0),
    isRegistered: true,
  } : null;

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading author profile...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <Link href="/skills" className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition">
              <FiArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-heading font-bold text-gray-900 dark:text-white">
                Author Profile
              </h1>
              <button
                onClick={copyPubkey}
                className="flex items-center gap-1.5 font-mono text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition mt-1"
              >
                {shortAddr(pubkey)}
                {copied ? <FiCheck className="w-3.5 h-3.5 text-green-500" /> : <FiCopy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Trust Badge */}
        {!profile ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6 text-center">
            <FiShield className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">This author is not registered on-chain yet.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6">
            <TrustBadge trust={trustData} />
            {profile.registeredAt && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 flex items-center gap-1">
                <FiCalendar className="w-3 h-3" />
                Member since {formatDate(Number(profile.registeredAt))}
              </p>
            )}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Skills Published', value: skillsPublished.toString(), icon: <FiPackage /> },
            { label: 'Total Downloads', value: totalDownloads.toLocaleString(), icon: <FiDownload /> },
            { label: 'Total Revenue', value: `${formatSol(totalRevenue)} SOL`, icon: <FiTrendingUp /> },
            { label: 'Vouches Received', value: vouchesReceived.length.toString(), icon: <FiUsers /> },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-center">
              <div className="flex items-center justify-center text-blue-600 dark:text-blue-400 mb-1">
                {stat.icon}
              </div>
              <div className="text-xl font-heading font-bold text-gray-900 dark:text-white">{stat.value}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Vouch for this author */}
        {connected && myProfile && !isOwnProfile && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6">
            <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <FiZap className="text-blue-600 dark:text-blue-400" /> Vouch for this Author
            </h2>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stake Amount (SOL)</label>
                <input
                  type="number"
                  value={vouchAmount}
                  onChange={(e) => setVouchAmount(e.target.value)}
                  min="0.01"
                  step="0.01"
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none"
                />
              </div>
              <button
                onClick={handleVouch}
                disabled={vouching}
                className="self-end px-6 py-2.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white dark:text-gray-900 rounded-lg font-semibold text-sm transition"
              >
                {vouching ? 'Vouching...' : `Vouch with ${vouchAmount} SOL`}
              </button>
            </div>
            {vouchStatus && (
              <p className={`mt-3 text-sm ${vouchStatus.includes('Error') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {vouchStatus}
              </p>
            )}
          </div>
        )}

        {/* Skills */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6">
          <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FiPackage className="text-blue-600 dark:text-blue-400" /> Published Skills
          </h2>

          {repoSkills.length === 0 && chainSkills.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No skills published yet.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {repoSkills.map((skill) => {
                const downloads = (skill.total_installs ?? 0) + (skill.total_downloads ?? 0);
                return (
                  <Link
                    key={skill.id}
                    href={`/skills/${skill.id}`}
                    className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-4 hover:border-gray-300 dark:hover:border-gray-600 transition block"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-heading font-bold text-gray-900 dark:text-white text-sm truncate">{skill.name}</h3>
                      {skill.price_lamports && skill.price_lamports > 0 && (
                        <span className="text-xs font-semibold text-gray-900 dark:text-white shrink-0">{formatSol(skill.price_lamports)} SOL</span>
                      )}
                    </div>
                    {skill.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{skill.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                      <span className="flex items-center gap-1"><FiDownload className="w-3 h-3" />{downloads}</span>
                      {skill.tags?.length > 0 && (
                        <span className="flex items-center gap-1"><FiTag className="w-3 h-3" />{skill.tags.slice(0, 2).join(', ')}</span>
                      )}
                    </div>
                  </Link>
                );
              })}

              {chainSkills
                .filter(c => !repoSkills.some(r => r.on_chain_address === c.publicKey))
                .map((skill) => {
                  const downloads = Number(skill.account.totalDownloads ?? 0);
                  const price = Number(skill.account.priceLamports ?? 0);
                  return (
                    <Link
                      key={skill.publicKey}
                      href={`/skills/chain-${skill.publicKey}`}
                      className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-4 hover:border-gray-300 dark:hover:border-gray-600 transition block"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-heading font-bold text-gray-900 dark:text-white text-sm truncate">{skill.account.name || 'Untitled'}</h3>
                        {price > 0 && (
                          <span className="text-xs font-semibold text-gray-900 dark:text-white shrink-0">{formatSol(price)} SOL</span>
                        )}
                      </div>
                      {skill.account.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{skill.account.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                        <span className="flex items-center gap-1"><FiDownload className="w-3 h-3" />{downloads}</span>
                        <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-[10px] font-medium">on-chain</span>
                      </div>
                    </Link>
                  );
                })}
            </div>
          )}
        </div>

        {/* Vouchers (who vouches for this author) */}
        {vouchesReceived.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6">
            <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FiUsers className="text-blue-600 dark:text-blue-400" /> Vouchers
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {vouchesReceived.length} {vouchesReceived.length === 1 ? 'agent is' : 'agents are'} staking SOL for this author.
            </p>
            <div className="space-y-2">
              {vouchesReceived.map((vouch: any, idx: number) => {
                const voucher = vouch.account.voucher;
                const stakeAmount = vouch.account.stakeAmount || vouch.account.stake_amount;
                return (
                  <Link
                    key={idx}
                    href={`/author/${voucher}`}
                    className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-3 hover:border-gray-300 dark:hover:border-gray-600 transition"
                  >
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{shortAddr(voucher)}</span>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400 font-mono">
                      {formatSol(Number(stakeAmount))} SOL
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Vouching for (who this author vouches for) */}
        {vouchesGiven.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6">
            <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FiZap className="text-blue-600 dark:text-blue-400" /> Vouching For
            </h2>
            <div className="space-y-2">
              {vouchesGiven.map((vouch: any, idx: number) => {
                const vouchee = vouch.account.vouchee;
                const stakeAmount = vouch.account.stakeAmount || vouch.account.stake_amount;
                return (
                  <Link
                    key={idx}
                    href={`/author/${vouchee}`}
                    className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-3 hover:border-gray-300 dark:hover:border-gray-600 transition"
                  >
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{shortAddr(vouchee)}</span>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400 font-mono">
                      {formatSol(Number(stakeAmount))} SOL
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
