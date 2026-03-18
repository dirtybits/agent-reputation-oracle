'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useWalletConnection } from '@solana/react-hooks';
import { address, type Address } from '@solana/kit';
import Link from 'next/link';
import { AgentProfileSetupCard } from '@/components/AgentProfileSetupCard';
import { ClientWalletButton } from '@/components/ClientWalletButton';
import { navButtonPrimaryInlineClass } from '@/lib/buttonStyles';
import { useReputationOracle } from '@/hooks/useReputationOracle';
import { SolAmount } from '@/components/SolAmount';
import TrustBadge, { type TrustData } from '@/components/TrustBadge';
import { formatSolAmount } from '@/lib/pricing';
import {
  FiArrowLeft,
  FiCalendar,
  FiCheckCircle,
  FiCopy,
  FiCheck,
  FiDollarSign,
  FiDownload,
  FiExternalLink,
  FiLoader,
  FiPackage,
  FiShield,
  FiTag,
  FiTrendingUp,
  FiUsers,
  FiX,
  FiZap,
} from 'react-icons/fi';

function shortAddr(addr: string): string {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function formatSol(lamports: number): string {
  return formatSolAmount(lamports);
}

function formatDate(isoOrTimestamp: string | number): string {
  const d = typeof isoOrTimestamp === 'number'
    ? new Date(isoOrTimestamp * 1000)
    : new Date(isoOrTimestamp);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const [myProfileLoading, setMyProfileLoading] = useState(false);
  const [myProfileChecked, setMyProfileChecked] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerStatus, setRegisterStatus] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [showProfileGate, setShowProfileGate] = useState(false);
  const [pendingVouchAfterRegister, setPendingVouchAfterRegister] = useState(false);
  const myProfileFetchId = useRef(0);

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
    if (!connected || !myPubkey || isOwnProfile) {
      setMyProfile(null);
      setMyProfileLoading(false);
      setMyProfileChecked(false);
      return;
    }

    const fetchId = ++myProfileFetchId.current;
    setMyProfileLoading(true);
    setMyProfileChecked(false);
    oracle.getAgentProfile(address(myPubkey))
      .then((agentProfile) => {
        if (fetchId === myProfileFetchId.current) setMyProfile(agentProfile);
      })
      .catch(() => {
        if (fetchId === myProfileFetchId.current) setMyProfile(null);
      })
      .finally(() => {
        if (fetchId === myProfileFetchId.current) {
          setMyProfileLoading(false);
          setMyProfileChecked(true);
        }
      });
    // oracle is intentionally omitted — it changes reference every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, myPubkey, isOwnProfile]);

  const copyPubkey = () => {
    navigator.clipboard.writeText(pubkey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submitVouch = useCallback(async () => {
    if (!connected) return;
    const amount = parseFloat(vouchAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setVouchStatus('Error: Enter a valid stake amount in SOL.');
      setPendingVouchAfterRegister(false);
      return;
    }

    setVouching(true);
    setVouchStatus('Creating vouch...');
    try {
      const { tx } = await oracle.vouch(address(pubkey), amount);
      setVouchStatus(`Vouch created! TX: ${tx.slice(0, 16)}...`);
      setTimeout(loadData, 2000);
    } catch (error: any) {
      setVouchStatus(`Error: ${error.message}`);
    } finally {
      setVouching(false);
      setPendingVouchAfterRegister(false);
    }
  }, [connected, loadData, oracle, pubkey, vouchAmount]);

  const waitForReadableProfile = useCallback(async (agentKey: Address, attempts = 8) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const viewerProfile = await oracle.getAgentProfile(agentKey);
      if (viewerProfile) return viewerProfile;
      await sleep(500 * (attempt + 1));
    }
    return null;
  }, [oracle]);

  const handleVouch = async () => {
    if (!connected) {
      setVouchStatus('Connect your wallet to vouch for this author.');
      return;
    }

    if (!myProfile) {
      setPendingVouchAfterRegister(true);
      setRegisterError(null);
      setShowProfileGate(true);
      return;
    }

    await submitVouch();
  };

  const handleRegister = async () => {
    if (!connected || !myPubkey) return;

    setRegistering(true);
    setRegisterStatus('Waiting for wallet confirmation…');
    setRegisterError(null);

    try {
      await oracle.registerAgent('');
      setRegisterStatus('Profile created on-chain. Finalizing registration…');

      const viewerProfile = await waitForReadableProfile(address(myPubkey));
      if (!viewerProfile) {
        throw new Error('Profile transaction confirmed, but the account is not readable yet. Please wait a moment and try again.');
      }

      setMyProfile(viewerProfile);
      setMyProfileChecked(true);
      setShowProfileGate(false);

      if (pendingVouchAfterRegister) {
        setVouchStatus('Profile created. Waiting for vouch confirmation…');
        await sleep(800);
        await submitVouch();
      } else {
        setVouchStatus('Profile created. You can now vouch for this author.');
      }
    } catch (err: any) {
      const cause = err?.cause?.message ?? err?.context?.message ?? '';
      const msg = cause || err.message || String(err);
      const alreadyExists = /already in use|already exists|0x0|account already initialized/i.test(msg);

      if (alreadyExists) {
        setRegisterStatus('Profile already exists. Finalizing registration…');
        const viewerProfile = await waitForReadableProfile(address(myPubkey)).catch(() => null);
        if (viewerProfile) {
          setMyProfile(viewerProfile);
          setMyProfileChecked(true);
          setShowProfileGate(false);
          if (pendingVouchAfterRegister) {
            setVouchStatus('Profile already exists. Waiting for vouch confirmation…');
            await sleep(800);
            await submitVouch();
          } else {
            setVouchStatus('Profile already exists. You can now vouch for this author.');
          }
          return;
        }
      }

      setRegisterError(`Profile creation failed: ${msg}`);
    } finally {
      setRegisterStatus(null);
      setRegistering(false);
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
        {showProfileGate && connected && !myProfileLoading && !myProfile && !isOwnProfile && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="relative">
              <button
                onClick={() => {
                  setShowProfileGate(false);
                  setPendingVouchAfterRegister(false);
                }}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10"
              >
                <FiX className="w-4 h-4" />
              </button>
              <AgentProfileSetupCard
                registering={registering}
                status={registerStatus}
                onRegister={handleRegister}
                error={registerError}
                title="Create your profile to vouch"
                description="Before you stake behind an author you trust, set up your on-chain profile. This one-time step links your wallet to the reputation system, then returns you straight to vouching."
                primaryStepLabel="Create profile"
                secondaryStepLabel="Vouch"
                className="max-w-md mx-auto"
              />
            </div>
          </div>
        )}

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
              <div className="flex items-center justify-center text-[var(--lobster-accent)] mb-1">
                {stat.icon}
              </div>
              <div className="text-xl font-heading font-bold text-gray-900 dark:text-white">{stat.value}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Vouch for this author */}
        {!isOwnProfile && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6">
            <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <FiZap className="text-[var(--lobster-accent)]" /> Vouch for this Author
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Stake SOL behind this author&apos;s reputation. Vouchers earn 40% of author revenue.
            </p>

            {!profile ? (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-900/20 p-4">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  This author needs an on-chain profile before anyone can vouch for them.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-3">
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

                  {!connected ? (
                    <div className="sm:self-end">
                      <ClientWalletButton />
                    </div>
                  ) : !myProfileChecked || myProfileLoading ? (
                    <button
                      disabled
                      className={`sm:self-end opacity-70 cursor-wait ${navButtonPrimaryInlineClass}`}
                    >
                      <FiLoader className="w-4 h-4 animate-spin" />
                      Checking profile...
                    </button>
                  ) : !myProfile ? (
                    <button
                      onClick={handleVouch}
                      disabled={registering}
                      className={`sm:self-end ${navButtonPrimaryInlineClass}`}
                    >
                      {registering ? 'Preparing...' : `Vouch with ${vouchAmount} SOL`}
                    </button>
                  ) : (
                    <button
                      onClick={handleVouch}
                      disabled={vouching}
                      className={`sm:self-end ${navButtonPrimaryInlineClass}`}
                    >
                      {vouching ? 'Vouching...' : `Vouch with ${vouchAmount} SOL`}
                    </button>
                  )}
                </div>

                {connected && myProfileChecked && !myProfile && (
                  <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                    First vouch from this wallet? We&apos;ll ask you to create a one-time on-chain profile, then continue to the vouch.
                  </p>
                )}
              </>
            )}

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
            <FiPackage className="text-[var(--lobster-accent)]" /> Published Skills
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
                        <span className="text-xs font-semibold text-gray-900 dark:text-white shrink-0">
                          <SolAmount amount={formatSol(skill.price_lamports)} iconClassName="w-3 h-3" />
                        </span>
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
                          <span className="text-xs font-semibold text-gray-900 dark:text-white shrink-0">
                            <SolAmount amount={formatSol(price)} iconClassName="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      {skill.account.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{skill.account.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                        <span className="flex items-center gap-1"><FiDownload className="w-3 h-3" />{downloads}</span>
                        <span className="px-1.5 py-0.5 bg-[var(--lobster-accent-soft)] text-[var(--lobster-accent)] rounded text-[10px] font-medium">on-chain</span>
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
              <FiUsers className="text-[var(--lobster-accent)]" /> Vouchers
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
              <FiZap className="text-[var(--lobster-accent)]" /> Vouching For
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
