'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useWalletConnection } from '@solana/react-hooks';
import { type Address } from '@solana/kit';
import Link from 'next/link';
import { useReputationOracle } from '@/hooks/useReputationOracle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ClientWalletButton } from '@/components/ClientWalletButton';
import TrustBadge, { type TrustData } from '@/components/TrustBadge';
import type { SkillListing, Purchase } from '../../generated/reputation-oracle/src/generated';
import {
  FiActivity,
  FiAward,
  FiBookOpen,
  FiBox,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiDownload,
  FiLoader,
  FiPackage,
  FiPlus,
  FiExternalLink,
  FiSearch,
  FiShield,
  FiShoppingCart,
  FiTag,
  FiTrendingUp,
  FiXCircle,
} from 'react-icons/fi';

type PageTab = 'browse' | 'my-purchases' | 'my-listings';

interface SkillRow {
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
  skill_uri?: string | null;
  source?: 'repo' | 'chain';
  created_at: string;
  author_trust: TrustData | null;
}

interface ApiResponse {
  skills: SkillRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

type SkillListingData = { publicKey: Address; account: SkillListing };
type PurchaseData = { publicKey: Address; account: Purchase };
type FeedItem = {
  publicKey: Address;
  buyer: Address;
  skillListing: Address;
  skillName: string;
  skillRepoId: string | null;
  author: Address;
  purchasedAt: number;
  pricePaid: number;
};

type SortOption = 'newest' | 'installs' | 'trusted' | 'name';

const LAMPORTS_PER_SOL = 1_000_000_000;

function formatSol(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(2);
}

function shortAddr(addr: string): string {
  return addr.slice(0, 4) + '...' + addr.slice(-4);
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString();
}

export default function MarketplacePage() {
  const { wallet, status } = useWalletConnection();
  const connected = status === 'connected' && !!wallet;
  const publicKey = wallet?.account.address ?? null;
  const oracle = useReputationOracle();

  const [activeTab, setActiveTab] = useState<PageTab>('browse');

  // Browse state
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Marketplace state
  const [listings, setListings] = useState<SkillListingData[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchasedKeys, setPurchasedKeys] = useState<Set<Address>>(new Set());
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  // My data
  const [myPurchases, setMyPurchases] = useState<PurchaseData[]>([]);
  const [myListings, setMyListings] = useState<SkillListingData[]>([]);

  // Feed state
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [repoSkillMap, setRepoSkillMap] = useState<Map<string, string>>(new Map());

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      params.set('sort', sort);
      params.set('page', String(page));

      const res = await fetch(`/api/skills?${params}`);
      if (!res.ok) throw new Error('Failed to fetch skills');
      const data: ApiResponse = await res.json();

      setSkills(data.skills);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      console.error('Error fetching skills:', err);
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, [search, sort, page]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadFeed = useCallback(async (
    resolvedListings: SkillListingData[],
    repoMap: Map<string, string>,
  ) => {
    setFeedLoading(true);
    try {
      const purchases = await oracle.getAllPurchases();
      const listingMap = new Map(resolvedListings.map((l) => [l.publicKey as string, l]));
      const items: FeedItem[] = purchases
        .map((p) => {
          const listing = listingMap.get(p.account.skillListing as string);
          return {
            publicKey: p.publicKey,
            buyer: p.account.buyer,
            skillListing: p.account.skillListing,
            skillName: listing?.account.name ?? 'Unknown Skill',
            skillRepoId: repoMap.get(p.account.skillListing as string) ?? null,
            author: listing?.account.author ?? ('' as Address),
            purchasedAt: Number(p.account.purchasedAt),
            pricePaid: Number(p.account.pricePaid),
          };
        })
        .sort((a, b) => b.purchasedAt - a.purchasedAt)
        .slice(0, 20);
      setFeedItems(items);
    } catch (e) {
      console.error('Failed to load feed:', e);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  const loadListings = useCallback(async () => {
    try {
      const all = await oracle.getAllSkillListings();
      const UUID_RE = /\/api\/skills\/([0-9a-f-]{36})\/raw/i;
      const repoMap = new Map<string, string>(
        all
          .map((l) => {
            const match = l.account.skillUri?.match(UUID_RE);
            return match ? [l.publicKey as string, match[1]] : null;
          })
          .filter((entry): entry is [string, string] => entry !== null)
      );
      setRepoSkillMap(repoMap);
      setListings(all);
      void loadFeed(all, repoMap);
    } catch (e) {
      console.error('Failed to load listings:', e);
    }
  }, []);

  const loadMyData = useCallback(async () => {
    if (!publicKey) return;
    try {
      const [purchases, authorListings] = await Promise.all([
        oracle.getPurchasesByBuyer(publicKey),
        oracle.getSkillListingsByAuthor(publicKey),
      ]);
      setMyPurchases(purchases);
      setMyListings(authorListings);
      setPurchasedKeys(new Set(purchases.map((p) => p.account.skillListing)));
    } catch (e) {
      console.error('Failed to load user data:', e);
    }
  }, [publicKey]);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);
  useEffect(() => { loadListings(); }, [loadListings]);
  useEffect(() => { loadMyData(); }, [loadMyData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchSkills();
  };

  const handlePurchase = async (listingPubkey: Address, authorKey: Address) => {
    if (!connected) return;
    setPurchasing(listingPubkey as string);
    setTxError(null);
    setTxSuccess(null);
    try {
      const { tx } = await oracle.purchaseSkill(listingPubkey, authorKey);
      setTxSuccess(tx);
      await Promise.all([loadListings(), loadMyData()]);
    } catch (e: any) {
      console.error('Purchase failed:', e);
      setTxError(e.message || 'Transaction failed');
    } finally {
      setPurchasing(null);
    }
  };

  const getListingForSkill = (skill: SkillRow): SkillListingData | undefined => {
    if (skill.on_chain_address) {
      return listings.find((l) => (l.publicKey as string) === skill.on_chain_address);
    }
    return undefined;
  };

  const sortOptions: { value: SortOption; label: string; icon: React.ReactNode }[] = [
    { value: 'newest', label: 'Newest', icon: <FiClock className="w-3.5 h-3.5" /> },
    { value: 'trusted', label: 'Most Trusted', icon: <FiShield className="w-3.5 h-3.5" /> },
    { value: 'installs', label: 'Most Installed', icon: <FiTrendingUp className="w-3.5 h-3.5" /> },
    { value: 'name', label: 'Name', icon: <FiBookOpen className="w-3.5 h-3.5" /> },
  ];

  const tabs: { key: PageTab; label: string; icon: ReactNode }[] = [
    { key: 'browse', label: 'Browse', icon: <FiBookOpen className="inline-block mr-1" /> },
    { key: 'my-purchases', label: 'My Purchases', icon: <FiShoppingCart className="inline-block mr-1" /> },
    { key: 'my-listings', label: 'My Listings', icon: <FiPackage className="inline-block mr-1" /> },
  ];

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/"
                className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition"
              >
                ← Home
              </Link>
              <span className="text-gray-300 dark:text-gray-700">/</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">Marketplace</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 dark:text-white mb-1">
              Marketplace
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Browse, buy, and publish AI agent skills. Every skill shows author trust signals.
              {total > 0 && activeTab === 'browse' && <span className="ml-2 text-gray-400">({total} skills)</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/competition"
              className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm font-semibold hover:border-yellow-300 dark:hover:border-yellow-700 transition"
            >
              <FiAward className="w-4 h-4" />
              Competition
            </Link>
            <Link
              href="/skills/publish"
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition"
            >
              <FiPlus className="w-4 h-4" />
              Publish Skill
            </Link>
            <ThemeToggle />
            <ClientWalletButton />
          </div>
        </div>

        {/* Toast notifications */}
        {txSuccess && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-green-600 dark:text-green-400"><FiCheckCircle /></span>
              <span className="text-green-800 dark:text-green-200 text-sm">
                Transaction confirmed:{' '}
                <a
                  href={`https://explorer.solana.com/tx/${txSuccess}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-mono"
                >
                  {shortAddr(txSuccess)}
                </a>
              </span>
            </div>
            <button onClick={() => setTxSuccess(null)} className="text-green-600 dark:text-green-400 hover:text-green-800">✕</button>
          </div>
        )}
        {txError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-red-600 dark:text-red-400"><FiXCircle /></span>
              <span className="text-red-800 dark:text-red-200 text-sm">{txError}</span>
            </div>
            <button onClick={() => setTxError(null)} className="text-red-600 dark:text-red-400 hover:text-red-800">✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-8 overflow-x-auto pb-2 border-b border-gray-200 dark:border-gray-800">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 font-medium whitespace-nowrap transition text-sm border-b-2 -mb-[2px] ${
                activeTab === tab.key
                  ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ===== BROWSE TAB ===== */}
        {activeTab === 'browse' && (
          <div className="flex gap-8 items-start">
            <div className="flex-1 min-w-0">
              {/* Search + Sort */}
              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <form onSubmit={handleSearch} className="flex-1 relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search skills..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition"
                  />
                </form>
                <div className="flex items-center gap-2">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSort(opt.value); setPage(1); }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                        sort === opt.value
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                          : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skill Cards */}
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <FiLoader className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : skills.length === 0 ? (
                <div className="text-center py-20">
                  <FiBookOpen className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 mb-2">No skills found</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    {search ? 'Try a different search term' : 'Be the first to publish a skill'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {skills.map((skill) => {
                      const downloads = (skill.total_installs ?? 0) + (skill.total_downloads ?? 0);
                      const listing = getListingForSkill(skill);
                      const hasPurchased = listing ? purchasedKeys.has(listing.publicKey) : false;
                      const isOwn = publicKey && skill.author_pubkey === (publicKey as string);
                      const isPurchasing = listing ? purchasing === (listing.publicKey as string) : false;
                      const price = skill.price_lamports ?? 0;

                      return (
                        <div
                          key={skill.id}
                          className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:border-gray-300 dark:hover:border-gray-700 transition flex flex-col"
                        >
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-3">
                              <Link
                                href={`/skills/${skill.id}`}
                                className="text-base font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition hover:underline"
                              >
                                {skill.name}
                              </Link>
                              <div className="flex items-center gap-2 shrink-0">
                                {price > 0 ? (
                                  <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold">
                                    <FiDollarSign className="w-3 h-3" />
                                    {formatSol(price)} SOL
                                  </span>
                                ) : listing && (
                                  <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-semibold">
                                    Free
                                  </span>
                                )}
                                {skill.source !== 'chain' && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                                    v{skill.current_version}
                                  </span>
                                )}
                              </div>
                            </div>

                            {skill.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                                {skill.description}
                              </p>
                            )}

                            <div className="mb-3">
                              <TrustBadge trust={skill.author_trust} compact />
                            </div>

                            <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <FiDownload className="w-3.5 h-3.5" />
                                  {downloads}
                                </span>
                                {skill.tags?.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <FiTag className="w-3.5 h-3.5" />
                                    {skill.tags.slice(0, 2).join(', ')}
                                  </span>
                                )}
                              </div>
                              <Link
                                href={`/author/${skill.author_pubkey}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-mono hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition"
                                title={skill.author_pubkey}
                              >
                                {shortAddr(skill.author_pubkey)}
                              </Link>
                            </div>

                            {skill.ipfs_cid && (
                              <div className="mt-2 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                                <FiShield className="w-3 h-3" />
                                <span className="font-mono truncate" title={skill.ipfs_cid}>
                                  {skill.ipfs_cid.slice(0, 12)}...
                                </span>
                              </div>
                            )}
                          </div>

                          {skill.skill_uri && (
                            <a
                              href={skill.skill_uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
                            >
                              <FiExternalLink className="w-3 h-3 shrink-0" />
                              <span className="truncate">{skill.skill_uri}</span>
                            </a>
                          )}

                          {/* Purchase / View action for on-chain skills */}
                          {listing && (
                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                              {isOwn ? (
                                <div className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 rounded-lg font-medium text-center text-xs border border-gray-200 dark:border-gray-700">
                                  Your Skill
                                </div>
                              ) : price === 0 ? (
                                <Link
                                  href={`/skills/${skill.id}`}
                                  className="w-full px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg font-medium text-center text-xs border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition flex items-center justify-center gap-1"
                                >
                                  <FiDownload className="w-3 h-3" /> Free — View & Install
                                </Link>
                              ) : hasPurchased ? (
                                <div className="w-full px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg font-medium text-center text-xs border border-green-200 dark:border-green-800">
                                  <span className="inline-flex items-center gap-1"><FiCheckCircle className="w-3 h-3" /> Purchased</span>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handlePurchase(listing.publicKey, listing.account.author);
                                  }}
                                  disabled={!connected || isPurchasing}
                                  className="w-full px-3 py-2 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white dark:text-gray-900 disabled:text-gray-500 rounded-lg font-semibold transition text-xs"
                                >
                                  {isPurchasing ? (
                                    <span className="animate-pulse">Processing...</span>
                                  ) : connected ? (
                                    `Buy for ${formatSol(price)} SOL`
                                  ) : (
                                    'Connect Wallet to Buy'
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8">
                      <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Activity Feed sidebar */}
            <aside className="hidden lg:block w-72 flex-shrink-0">
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden sticky top-6">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <FiActivity className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Recent Activity</span>
                  {feedLoading && (
                    <span className="ml-auto">
                      <FiLoader className="w-3 h-3 text-gray-400 animate-spin" />
                    </span>
                  )}
                </div>

                {feedItems.length === 0 && !feedLoading ? (
                  <div className="px-4 py-8 text-center">
                    <FiClock className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-700" />
                    <p className="text-xs text-gray-400 dark:text-gray-500">No purchases yet. Be the first!</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-50 dark:divide-gray-800/50 max-h-[520px] overflow-y-auto">
                    {feedItems.map((item) => (
                      <li key={item.publicKey} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                        <p className="text-xs text-gray-900 dark:text-gray-100 leading-relaxed">
                          <Link
                            href={`/author/${item.buyer}`}
                            className="font-mono font-medium text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {shortAddr(item.buyer)}
                          </Link>{' '}
                          bought{' '}
                          {item.skillRepoId ? (
                            <Link
                              href={`/skills/${item.skillRepoId}`}
                              className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition"
                            >
                              &ldquo;{item.skillName}&rdquo;
                            </Link>
                          ) : (
                            <span className="font-semibold text-gray-900 dark:text-white">
                              &ldquo;{item.skillName}&rdquo;
                            </span>
                          )}{' '}
                          {item.author ? (
                            <>
                              from{' '}
                              <Link
                                href={`/author/${item.author}`}
                                className="font-mono font-medium text-purple-600 dark:text-purple-400 hover:underline"
                              >
                                {shortAddr(item.author)}
                              </Link>
                            </>
                          ) : null}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400 dark:text-gray-500 inline-flex items-center gap-1">
                            <FiClock className="w-3 h-3" />
                            {timeAgo(item.purchasedAt)}
                          </span>
                          {item.pricePaid > 0 && (
                            <span className="text-xs font-mono text-green-600 dark:text-green-400">
                              {formatSol(item.pricePaid)} SOL
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* ===== MY PURCHASES TAB ===== */}
        {activeTab === 'my-purchases' && (
          <div>
            {!connected ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-2xl text-gray-400 dark:text-gray-500"><FiShoppingCart /></div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Connect Wallet</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Connect your wallet to see your purchases.</p>
              </div>
            ) : myPurchases.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-2xl text-gray-400 dark:text-gray-500"><FiShoppingCart /></div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No purchases yet</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Browse the marketplace to find useful skills.</p>
                <button
                  onClick={() => setActiveTab('browse')}
                  className="px-6 py-3 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg font-semibold transition text-sm"
                >
                  <span className="inline-flex items-center gap-2"><FiBookOpen /> Browse Skills</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myPurchases.map((purchase) => {
                  const listing = listings.find(
                    (l) => l.publicKey === purchase.account.skillListing
                  );
                  return (
                    <div
                      key={purchase.publicKey}
                      className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 flex items-center justify-between"
                    >
                      <div>
                        <h3 className="font-heading font-bold text-gray-900 dark:text-white">
                          {listing?.account.name || 'Unknown Skill'}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Purchased {formatDate(Number(purchase.account.purchasedAt))} ·{' '}
                          <span className="font-mono">{formatSol(Number(purchase.account.pricePaid))} SOL</span>
                        </p>
                      </div>
                      {listing?.account.skillUri && (
                        <a
                          href={listing.account.skillUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition"
                        >
                          <span className="inline-flex items-center gap-1"><FiDownload /> Download</span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== MY LISTINGS TAB ===== */}
        {activeTab === 'my-listings' && (
          <div>
            {!connected ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-2xl text-gray-400 dark:text-gray-500"><FiBox /></div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Connect Wallet</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Connect your wallet to see your listings.</p>
              </div>
            ) : myListings.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-2xl text-gray-400 dark:text-gray-500"><FiBox /></div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No skills published</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Publish your first skill to start earning.</p>
                <Link
                  href="/skills/publish"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg font-semibold transition text-sm"
                >
                  <FiPlus /> Publish a Skill
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {myListings.map((listing) => {
                  const price = Number(listing.account.priceLamports);
                  const downloads = Number(listing.account.totalDownloads);
                  const revenue = Number(listing.account.totalRevenue);
                  const authorEarnings = revenue * 0.6;

                  return (
                    <div
                      key={listing.publicKey}
                      className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-heading font-bold text-gray-900 dark:text-white">
                          {listing.account.name}
                        </h3>
                        <span className="text-green-600 dark:text-green-400 font-mono font-bold">
                          {formatSol(price)} SOL
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {listing.account.description}
                      </p>
                      <div className="flex gap-4 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          <span className="inline-flex items-center gap-1"><FiDownload /> {downloads} downloads</span>
                        </span>
                        <span className="text-green-600 dark:text-green-400 font-mono">
                          <span className="inline-flex items-center gap-1"><FiTrendingUp /> {formatSol(revenue)} SOL total ({formatSol(authorEarnings)} your share)</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
