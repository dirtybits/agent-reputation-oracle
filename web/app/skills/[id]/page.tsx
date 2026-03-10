'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import TrustBadge, { type TrustData } from '@/components/TrustBadge';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { SolAmount } from '@/components/SolAmount';
import { useWalletConnection } from '@solana/react-hooks';
import { useReputationOracle } from '@/hooks/useReputationOracle';
import { PRICING, formatMinPrice, toLamports, fromLamports } from '@/lib/pricing';
import type { Address } from '@solana/kit';
import { SiSolana } from 'react-icons/si';
import {
  FiArrowLeft,
  FiCheckCircle,
  FiDownload,
  FiTag,
  FiClock,
  FiShield,
  FiCopy,
  FiCheck,
  FiLoader,
  FiExternalLink,
  FiFileText,
  FiGitCommit,
  FiEdit2,
} from 'react-icons/fi';

interface SkillVersion {
  id: string;
  version: number;
  ipfs_cid: string | null;
  changelog: string | null;
  created_at: string;
}

interface ContentVerification {
  has_ipfs: boolean;
  all_versions_pinned: boolean;
  current_cid_consistent: boolean;
  status: 'verified' | 'drift_detected' | 'unverified';
}

interface SkillDetail {
  id: string;
  skill_id: string;
  author_pubkey: string;
  name: string;
  description: string | null;
  tags: string[];
  current_version: number;
  ipfs_cid: string | null;
  on_chain_address: string | null;
  total_installs: number;
  total_downloads?: number;
  price_lamports?: number;
  contact: string | null;
  created_at: string;
  updated_at: string;
  source?: 'repo' | 'chain';
  skill_uri?: string;
  versions: SkillVersion[];
  author_trust: TrustData | null;
  content_verification: ContentVerification | null;
}

function shortAddr(addr: string): string {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function SkillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { wallet, status } = useWalletConnection();
  const connected = status === 'connected' && !!wallet;
  const walletAddress = wallet?.account.address ?? null;
  const signMessage = wallet?.signMessage ?? null;
  const oracle = useReputationOracle();

  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const [listPrice, setListPrice] = useState(String(PRICING.SOL.defaultPrice));
  const [listing, setListing] = useState(false);
  const [listResult, setListResult] = useState<{ success: boolean; message: string } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<{ success: boolean; message: string } | null>(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editUri, setEditUri] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    async function fetchSkill() {
      try {
        const detailRes = await fetch(`/api/skills/${id}?include=trust`);
        if (!detailRes.ok) throw new Error('Skill not found');
        const data = await detailRes.json();
        setSkill(data);
        if (data.content) {
          setContent(data.content);
        }
      } catch (err) {
        console.error('Error fetching skill:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSkill();
  }, [id]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleListOnMarketplace = async () => {
    if (!connected || !walletAddress || !signMessage || !skill) return;
    setListing(true);
    setListResult(null);
    try {
      const priceLamports = toLamports(parseFloat(listPrice || '0'));
      if (priceLamports <= 0) {
        setListResult({ success: false, message: `Price must be greater than 0. Minimum is ${formatMinPrice()}.` });
        setListing(false);
        return;
      }
      const skillUri = `${window.location.origin}/api/skills/${id}/raw`;
      await oracle.createSkillListing(skill.skill_id, skillUri, skill.name, skill.description ?? '', priceLamports);
      const onChainAddress = await oracle.getSkillListingPDA(walletAddress as Address, skill.skill_id);

      const timestamp = Date.now();
      const message = `AgentVouch Skill Repo\nAction: publish-skill\nTimestamp: ${timestamp}`;
      const msgBytes = new TextEncoder().encode(message);
      const sigBytes = await signMessage(msgBytes);
      const signature = Buffer.from(sigBytes).toString('base64');

      await fetch(`/api/skills/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth: { pubkey: walletAddress, signature, message, timestamp },
          on_chain_address: onChainAddress,
        }),
      });

      setSkill((s) => s ? { ...s, on_chain_address: onChainAddress } : s);
      setListResult({ success: true, message: 'Listed on marketplace successfully!' });
    } catch (err: any) {
      setListResult({ success: false, message: err.message || 'Failed to create listing' });
    } finally {
      setListing(false);
    }
  };

  const handleFreeInstall = async () => {
    if (!connected || !walletAddress || !signMessage || !skill) return;
    setInstalling(true);
    setInstallResult(null);
    try {
      const timestamp = Date.now();
      const message = `AgentVouch Skill Repo\nAction: install-skill\nTimestamp: ${timestamp}`;
      const msgBytes = new TextEncoder().encode(message);
      const sigBytes = await signMessage(msgBytes);
      const signature = Buffer.from(sigBytes).toString('base64');

      const res = await fetch(`/api/skills/${id}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth: { pubkey: walletAddress, signature, message, timestamp },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInstallResult({ success: false, message: data.error || 'Install failed' });
        return;
      }
      setInstallResult({ success: true, message: 'Skill installed successfully!' });
      setSkill((s) => s ? { ...s, total_installs: data.total_installs } : s);
    } catch (err: any) {
      setInstallResult({ success: false, message: err.message || 'Install failed' });
    } finally {
      setInstalling(false);
    }
  };

  const startEditing = () => {
    if (!skill) return;
    setEditName(skill.name);
    setEditDescription(skill.description ?? '');
    setEditPrice(skill.price_lamports ? fromLamports(skill.price_lamports).toString() : String(PRICING.SOL.defaultPrice));
    setEditUri(skill.skill_uri ?? '');
    setUpdateResult(null);
    setEditing(true);
  };

  const handleUpdateListing = async () => {
    if (!connected || !walletAddress || !skill) return;
    setUpdating(true);
    setUpdateResult(null);
    try {
      const priceLamports = toLamports(parseFloat(editPrice || '0'));
      if (priceLamports <= 0) {
        setUpdateResult({ success: false, message: `Price must be greater than 0. Minimum is ${formatMinPrice()}.` });
        setUpdating(false);
        return;
      }
      await oracle.updateSkillListing(skill.skill_id, editUri, editName, editDescription, priceLamports);
      setSkill((s) => s ? {
        ...s,
        name: editName,
        description: editDescription,
        price_lamports: priceLamports,
        skill_uri: editUri,
      } : s);
      setUpdateResult({ success: true, message: 'Listing updated on-chain!' });
      setEditing(false);
    } catch (err: any) {
      setUpdateResult({ success: false, message: err.message || 'Failed to update listing' });
    } finally {
      setUpdating(false);
    }
  };

  const isChainOnly = skill?.source === 'chain';
  const CANONICAL_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agentvouch.xyz';
  const installUrl = isChainOnly && skill?.skill_uri
    ? skill.skill_uri
    : `${CANONICAL_ORIGIN}/api/skills/${id}/raw`;
  const installCommand = `curl -sL ${installUrl} -o SKILL.md`;

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <FiLoader className="w-6 h-6 animate-spin text-gray-400" />
      </main>
    );
  }

  if (!skill) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Skill not found</p>
          <Link href="/skills" className="text-blue-600 dark:text-blue-400 hover:underline">
            ← Back to skills
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/skills"
                className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition flex items-center gap-1"
              >
                <FiArrowLeft className="w-3.5 h-3.5" />
                Skills
              </Link>
              <span className="text-gray-300 dark:text-gray-700">/</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{skill.name}</span>
            </div>
            <h1 className="text-3xl font-heading font-bold text-gray-900 dark:text-white">
              {skill.name}
            </h1>
            {skill.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{skill.description}</p>
            )}
          </div>
        </div>

        {/* Trust Section */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FiShield className="w-4 h-4" />
            Author Trust Signals
          </h2>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">Author:</span>
            <Link
              href={`/author/${skill.author_pubkey}`}
              className="flex items-center gap-1.5 font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline transition"
            >
              {shortAddr(skill.author_pubkey)}
              <FiExternalLink className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={() => copyToClipboard(skill.author_pubkey, 'author')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              title="Copy address"
            >
              {copied === 'author' ? <FiCheck className="w-3.5 h-3.5 text-green-500" /> : <FiCopy className="w-3.5 h-3.5" />}
            </button>
            {skill.author_trust?.registeredAt ? (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Registered {formatDate(new Date(skill.author_trust.registeredAt * 1000).toISOString())}
              </span>
            ) : null}
          </div>
          {skill.contact && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Contact: <span className="text-gray-900 dark:text-white">{skill.contact}</span>
            </p>
          )}
          <TrustBadge trust={skill.author_trust} />
        </div>

        {/* Meta Row */}
        <div className={`grid grid-cols-2 ${isChainOnly ? 'sm:grid-cols-4' : 'sm:grid-cols-4'} gap-3 mb-6`}>
          {skill.price_lamports != null && skill.price_lamports > 0 && (
            <div className="rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/10 p-3 text-center">
              <div className="text-lg font-bold text-green-700 dark:text-green-400 font-mono flex items-center justify-center">
                <SolAmount amount={fromLamports(skill.price_lamports).toFixed(4)} iconClassName="w-4 h-4" />
              </div>
              <div className="text-xs text-green-600 dark:text-green-500">Price</div>
            </div>
          )}
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">v{skill.current_version}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Version</div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white flex items-center justify-center gap-1">
              <FiDownload className="w-4 h-4" />
              {(skill.total_installs ?? 0) + (skill.total_downloads ?? 0)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Downloads</div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 text-center">
            <div className="text-sm font-bold text-gray-900 dark:text-white">{formatDate(skill.created_at)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Published</div>
          </div>
        </div>

        {/* Tags */}
        {skill.tags?.length > 0 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <FiTag className="w-4 h-4 text-gray-400" />
            {skill.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Install / Buy action */}
        {(skill.price_lamports == null || skill.price_lamports === 0) && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">Free Skill</div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Install with a wallet signature — no transaction fee.
                </p>
              </div>
              {connected ? (
                <button
                  onClick={handleFreeInstall}
                  disabled={installing}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-40"
                >
                  {installing ? (
                    <><FiLoader className="w-4 h-4 animate-spin" />Installing…</>
                  ) : (
                    <><FiDownload className="w-4 h-4" />Install</>
                  )}
                </button>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Connect wallet to install
                </span>
              )}
            </div>
            {installResult && (
              <p className={`text-xs mt-2 ${installResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {installResult.message}
              </p>
            )}
            {connected && walletAddress === skill.author_pubkey && skill.on_chain_address && (
              <p className="text-xs mt-2 text-amber-600 dark:text-amber-400">
                This skill is listed for free. You can set a price via Edit Listing above.
              </p>
            )}
          </div>
        )}

        {/* Install Command */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Install
            </span>
            <button
              onClick={() => copyToClipboard(installCommand, 'install')}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
            >
              {copied === 'install' ? <FiCheck className="w-3.5 h-3.5 text-green-500" /> : <FiCopy className="w-3.5 h-3.5" />}
              {copied === 'install' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="text-sm bg-gray-50 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto border border-gray-100 dark:border-gray-700">
            <code>{installCommand}</code>
          </pre>
        </div>

        {/* Agent API Access */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Agent API (x402)
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {skill.price_lamports != null && skill.price_lamports > 0
              ? <>This is a paid skill. Requests return <code className="text-amber-600 dark:text-amber-400">402</code> with payment requirements until a valid payment proof is provided.</>
              : <>This is a free skill. Agents receive content directly — no payment required.</>
            }
          </p>
          <div className="flex items-center gap-2">
            <pre className="flex-1 text-sm bg-gray-50 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto border border-gray-100 dark:border-gray-700">
              <code>{`GET /api/skills/${skill.id}/raw`}</code>
            </pre>
            <button
              onClick={() => copyToClipboard(`${typeof window !== 'undefined' ? window.location.origin : ''}/api/skills/${skill.id}/raw`, 'api')}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-900 dark:hover:text-white transition shrink-0"
            >
              {copied === 'api' ? <FiCheck className="w-3.5 h-3.5 text-green-500" /> : <FiCopy className="w-3.5 h-3.5" />}
              {copied === 'api' ? 'Copied!' : 'Copy URL'}
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Auth: <code className="text-gray-500 dark:text-gray-400">Authorization: Bearer sk_...</code> or wallet signature.{' '}
            <Link href="/settings" className="text-blue-600 dark:text-blue-400 hover:underline">
              Get API key →
            </Link>
          </p>
        </div>

        {/* IPFS CID */}
        {skill.ipfs_cid && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiShield className="w-4 h-4 text-green-500" />
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Content Hash (IPFS)
                </span>
              </div>
              <a
                href={`https://ipfs.io/ipfs/${skill.ipfs_cid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Verify on IPFS <FiExternalLink className="w-3 h-3" />
              </a>
            </div>
            <button
              onClick={() => copyToClipboard(skill.ipfs_cid!, 'cid')}
              className="mt-2 font-mono text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5 transition"
            >
              {skill.ipfs_cid}
              {copied === 'cid' ? <FiCheck className="w-3.5 h-3.5 text-green-500" /> : <FiCopy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        {/* Content Verification */}
        {skill.content_verification && (
          <div className={`rounded-xl border p-4 mb-6 ${
            skill.content_verification.status === 'verified'
              ? 'border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/10'
              : skill.content_verification.status === 'drift_detected'
              ? 'border-yellow-200 dark:border-yellow-800/50 bg-yellow-50 dark:bg-yellow-900/10'
              : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900'
          }`}>
            <div className="flex items-center gap-2">
              {skill.content_verification.status === 'verified' ? (
                <>
                  <FiShield className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    Content hash verified
                  </span>
                  <span className="text-xs text-green-600 dark:text-green-500 ml-1">
                    — All versions pinned to IPFS, current CID consistent
                  </span>
                </>
              ) : skill.content_verification.status === 'drift_detected' ? (
                <>
                  <FiShield className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                    Content updated since last pin
                  </span>
                  <span className="text-xs text-yellow-600 dark:text-yellow-500 ml-1">
                    — Current version may differ from previously vouched content
                  </span>
                </>
              ) : (
                <>
                  <FiShield className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Content not yet pinned to IPFS
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* On-chain listing section */}
        {skill.on_chain_address ? (
          <div className="rounded-xl border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/10 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                <FiCheckCircle className="w-4 h-4" />
                Listed on-chain
              </div>
              {connected && walletAddress === skill.author_pubkey && !editing && (
                <button
                  onClick={startEditing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  <FiEdit2 className="w-3.5 h-3.5" />
                  Edit Listing
                </button>
              )}
            </div>
            {updateResult && !editing && (
              <p className={`text-xs mt-2 ${updateResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {updateResult.message}
              </p>
            )}
            {editing && (
              <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800/50 space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={64}
                    className="w-full px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    maxLength={256}
                    rows={2}
                    className="w-full px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Price (SOL)</label>
                    <input
                      type="number"
                      min={PRICING.SOL.minPrice}
                      step={PRICING.SOL.step}
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Skill URI</label>
                    <input
                      type="text"
                      value={editUri}
                      onChange={(e) => setEditUri(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                {updateResult && (
                  <p className={`text-xs ${updateResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {updateResult.message}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleUpdateListing}
                    disabled={updating}
                    className="flex items-center gap-2 px-4 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-40"
                  >
                    {updating ? (
                      <><FiLoader className="w-4 h-4 animate-spin" />Updating…</>
                    ) : (
                      <>Save Changes</>
                    )}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    disabled={updating}
                    className="px-4 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : connected && walletAddress === skill.author_pubkey && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <SiSolana className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                List on Marketplace
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Create an on-chain SkillListing so other agents can purchase this skill.
            </p>

            {listResult && (
              <p className={`text-xs mb-3 ${listResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {listResult.message}
              </p>
            )}

            <div className="flex items-center gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Price (SOL)</label>
                <input
                  type="number"
                  min={PRICING.SOL.minPrice}
                  step={PRICING.SOL.step}
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value)}
                  className="w-28 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleListOnMarketplace}
                disabled={listing}
                className="mt-5 flex items-center gap-2 px-4 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-40"
              >
                {listing ? (
                  <><FiLoader className="w-4 h-4 animate-spin" />Creating listing…</>
                ) : (
                  <><SiSolana className="w-4 h-4" />List Now</>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Minimum price is {formatMinPrice()}. Requires one Solana transaction.
            </p>
          </div>
        )}

        {/* Skill URI */}
        {skill.skill_uri && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiExternalLink className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Skill Source
                </span>
              </div>
            </div>
            <a
              href={skill.skill_uri}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              {skill.skill_uri}
            </a>
          </div>
        )}

        {/* SKILL.md Content */}
        {content ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
              <FiFileText className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                SKILL.md Content
              </span>
            </div>
            <MarkdownRenderer content={content} />
          </div>
        ) : isChainOnly && skill.skill_uri && (
          <div className="rounded-xl border border-yellow-200 dark:border-yellow-800/50 bg-yellow-50 dark:bg-yellow-900/10 p-4 mb-6">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Content could not be loaded from the source URL. The file may have been moved or is temporarily unavailable.
            </p>
          </div>
        )}

        {/* Version History */}
        {skill.versions?.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
              <FiGitCommit className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Version History
              </span>
            </div>
            <div className="space-y-3">
              {skill.versions.map((ver) => (
                <div
                  key={ver.id}
                  className="flex items-start justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        v{ver.version}
                      </span>
                      {ver.version === skill.current_version && (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs">
                          latest
                        </span>
                      )}
                    </div>
                    {ver.changelog && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{ver.changelog}</p>
                    )}
                    {ver.ipfs_cid && (
                      <span className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-1 block">
                        CID: {ver.ipfs_cid.slice(0, 16)}...
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                    <FiClock className="w-3 h-3" />
                    {formatDate(ver.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
