'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import Link from 'next/link';
import { useReputationOracle } from '@/hooks/useReputationOracle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ClientWalletButton } from '@/components/ClientWalletButton';
import {
  FiBookOpen,
  FiBox,
  FiCheckCircle,
  FiDownload,
  FiEdit3,
  FiFileText,
  FiLoader,
  FiPackage,
  FiShield,
  FiShoppingCart,
  FiTool,
  FiTrendingUp,
  FiUser,
  FiXCircle,
  FiZap,
} from 'react-icons/fi';

type MarketTab = 'browse' | 'publish' | 'my-purchases' | 'my-listings';

interface SkillListingData {
  publicKey: PublicKey;
  account: {
    author: PublicKey;
    skillUri: string;
    name: string;
    description: string;
    priceLamports: { toNumber(): number };
    totalDownloads: { toNumber(): number };
    totalRevenue: { toNumber(): number };
    createdAt: { toNumber(): number };
    updatedAt: { toNumber(): number };
    status: { active?: {} };
    bump: number;
  };
}

interface PurchaseData {
  publicKey: PublicKey;
  account: {
    buyer: PublicKey;
    skillListing: PublicKey;
    purchasedAt: { toNumber(): number };
    pricePaid: { toNumber(): number };
    bump: number;
  };
}

export default function MarketplacePage() {
  const { publicKey, connected } = useWallet();
  const oracle = useReputationOracle();

  const [activeTab, setActiveTab] = useState<MarketTab>('browse');
  const [listings, setListings] = useState<SkillListingData[]>([]);
  const [myPurchases, setMyPurchases] = useState<PurchaseData[]>([]);
  const [myListings, setMyListings] = useState<SkillListingData[]>([]);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'newest' | 'popular'>('all');
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  // Publish form state
  const [publishForm, setPublishForm] = useState({
    skillId: '',
    name: '',
    description: '',
    skillUri: '',
    price: '0.1',
  });
  const [publishing, setPublishing] = useState(false);

  // Set of purchased skill listing keys for the current user
  const [purchasedKeys, setPurchasedKeys] = useState<Set<string>>(new Set());

  const loadListings = useCallback(async () => {
    // Don't require wallet connection to view listings
    if (!oracle.readOnlyProgram) return;
    setLoading(true);
    try {
      const all = await oracle.getAllSkillListings();
      // Filter active only
      let active = all.filter((l: SkillListingData) => l.account.status?.active !== undefined);

      if (filter === 'newest') {
        active.sort((a: SkillListingData, b: SkillListingData) =>
          b.account.createdAt.toNumber() - a.account.createdAt.toNumber()
        );
      } else if (filter === 'popular') {
        active.sort((a: SkillListingData, b: SkillListingData) =>
          b.account.totalDownloads.toNumber() - a.account.totalDownloads.toNumber()
        );
      }

      setListings(active);
    } catch (e) {
      console.error('Failed to load listings:', e);
    } finally {
      setLoading(false);
    }
  }, [oracle.readOnlyProgram, filter]);

  const loadMyData = useCallback(async () => {
    // Use readOnlyProgram so it works even without wallet for initial load
    if (!oracle.readOnlyProgram || !publicKey) return;
    try {
      const [purchases, authorListings] = await Promise.all([
        oracle.getPurchasesByBuyer(publicKey),
        oracle.getSkillListingsByAuthor(publicKey),
      ]);
      setMyPurchases(purchases);
      setMyListings(authorListings);
      setPurchasedKeys(new Set(purchases.map((p: PurchaseData) => p.account.skillListing.toBase58())));
    } catch (e) {
      console.error('Failed to load user data:', e);
    }
  }, [oracle.readOnlyProgram, publicKey]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  useEffect(() => {
    loadMyData();
  }, [loadMyData]);

  const handlePurchase = async (listing: SkillListingData) => {
    if (!connected) return;
    setPurchasing(listing.publicKey.toBase58());
    setTxError(null);
    setTxSuccess(null);

    try {
      const { tx } = await oracle.purchaseSkill(listing.publicKey, listing.account.author);
      setTxSuccess(tx);
      // Refresh data
      await Promise.all([loadListings(), loadMyData()]);
    } catch (e: any) {
      console.error('Purchase failed:', e);
      setTxError(e.message || 'Transaction failed');
    } finally {
      setPurchasing(null);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected) return;
    setPublishing(true);
    setTxError(null);
    setTxSuccess(null);

    try {
      const priceLamports = Math.round(parseFloat(publishForm.price) * LAMPORTS_PER_SOL);
      const { tx } = await oracle.createSkillListing(
        publishForm.skillId,
        publishForm.skillUri,
        publishForm.name,
        publishForm.description,
        priceLamports
      );
      setTxSuccess(tx);
      setPublishForm({ skillId: '', name: '', description: '', skillUri: '', price: '0.1' });
      setActiveTab('browse');
      await Promise.all([loadListings(), loadMyData()]);
    } catch (e: any) {
      console.error('Publish failed:', e);
      setTxError(e.message || 'Transaction failed');
    } finally {
      setPublishing(false);
    }
  };

  const formatSOL = (lamports: number) => (lamports / LAMPORTS_PER_SOL).toFixed(2);
  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleDateString();
  const shortAddr = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  const tabs: { key: MarketTab; label: string; icon: ReactNode }[] = [
    { key: 'browse', label: 'Browse Skills', icon: <FiBookOpen className="inline-block mr-1" /> },
    { key: 'publish', label: 'Publish Skill', icon: <FiEdit3 className="inline-block mr-1" /> },
    { key: 'my-purchases', label: 'My Purchases', icon: <FiShoppingCart className="inline-block mr-1" /> },
    { key: 'my-listings', label: 'My Listings', icon: <FiPackage className="inline-block mr-1" /> },
  ];

  return (
    <main className="min-h-screen p-4 md:p-8 bg-white dark:bg-gray-900 transition-colors">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 dark:text-white mb-2">
              Skill Marketplace
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Discover, buy, and publish AI agent skills. Revenue shared 60/40 with vouchers.
            </p>
          </div>
          <div className="flex gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-semibold transition"
            >
              ← Back
            </Link>
            <ClientWalletButton />
          </div>
        </div>

        {/* Toast notifications */}
        {txSuccess && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-between">
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
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-red-600 dark:text-red-400"><FiXCircle /></span>
              <span className="text-red-800 dark:text-red-200 text-sm">{txError}</span>
            </div>
            <button onClick={() => setTxError(null)} className="text-red-600 dark:text-red-400 hover:text-red-800">✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition text-sm ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ===== BROWSE TAB ===== */}
        {activeTab === 'browse' && (
          <>
            {/* Filters */}
            <div className="flex gap-2 mb-6">
              {(['all', 'newest', 'popular'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    filter === f
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {f === 'all' && 'All'}
                  {f === 'newest' && <span className="inline-flex items-center gap-1"><FiTrendingUp /> Newest</span>}
                  {f === 'popular' && <span className="inline-flex items-center gap-1"><FiZap /> Popular</span>}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                <div className="animate-spin text-4xl mb-4 inline-block"><FiLoader /></div>
                <p>Loading skills from chain...</p>
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4 inline-block"><FiTool /></div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No skills listed yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Be the first to publish a skill on the marketplace!
                </p>
                <button
                  onClick={() => setActiveTab('publish')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
                >
                  <span className="inline-flex items-center gap-2"><FiEdit3 /> Publish a Skill</span>
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map((listing) => {
                  const price = listing.account.priceLamports.toNumber();
                  const downloads = listing.account.totalDownloads.toNumber();
                  const revenue = listing.account.totalRevenue.toNumber();
                  const alreadyPurchased = purchasedKeys.has(listing.publicKey.toBase58());
                  const isOwn = publicKey && listing.account.author.equals(publicKey);
                  const isPurchasing = purchasing === listing.publicKey.toBase58();

                  return (
                    <div
                      key={listing.publicKey.toBase58()}
                      className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-lg font-heading font-bold text-gray-900 dark:text-white">
                          {listing.account.name}
                        </h3>
                        <div className="text-green-600 dark:text-green-400 font-bold text-xl whitespace-nowrap ml-2 font-mono">
                          {formatSOL(price)} SOL
                        </div>
                      </div>

                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                        {listing.account.description}
                      </p>

                      <div className="flex items-center gap-2 mb-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          <span className="inline-flex items-center gap-1"><FiUser /> {shortAddr(listing.account.author.toBase58())}</span>
                        </span>
                        <span className="text-xs">
                          {formatDate(listing.account.createdAt.toNumber())}
                        </span>
                      </div>

                      <div className="mb-4 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Skill Address</div>
                        <div className="flex items-center gap-2 justify-between">
                          <span className="font-mono text-xs text-gray-900 dark:text-gray-100 truncate">
                            {shortAddr(listing.publicKey.toBase58())}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(listing.publicKey.toBase58());
                              const btn = event?.target as HTMLButtonElement;
                              const originalText = btn.textContent;
                              btn.textContent = 'Copied';
                              setTimeout(() => {
                                btn.textContent = originalText;
                              }, 2000);
                            }}
                            className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded transition"
                          >
                            Copy
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
                          <div className="text-gray-500 dark:text-gray-400 text-xs">Downloads</div>
                          <div className="text-gray-900 dark:text-white font-bold">{downloads}</div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
                          <div className="text-gray-500 dark:text-gray-400 text-xs">Revenue</div>
                          <div className="text-green-600 dark:text-green-400 font-bold font-mono">
                            {formatSOL(revenue)} SOL
                          </div>
                        </div>
                      </div>

                      {listing.account.skillUri && (
                        <a
                          href={listing.account.skillUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-blue-600 dark:text-blue-400 hover:underline mb-3 truncate"
                        >
                          <span className="inline-flex items-center gap-1"><FiFileText /> {listing.account.skillUri}</span>
                        </a>
                      )}

                      {isOwn ? (
                        <div className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg font-semibold text-center text-sm">
                          Your Skill
                        </div>
                      ) : alreadyPurchased ? (
                        <div className="w-full px-4 py-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg font-semibold text-center text-sm border border-green-200 dark:border-green-800">
                          <span className="inline-flex items-center gap-1"><FiCheckCircle /> Purchased</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handlePurchase(listing)}
                          disabled={!connected || isPurchasing}
                          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-lg font-semibold transition text-sm"
                        >
                          {isPurchasing ? (
                            <span className="animate-pulse">Processing...</span>
                          ) : connected ? (
                            `Buy for ${formatSOL(price)} SOL`
                          ) : (
                            'Connect Wallet'
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ===== PUBLISH TAB ===== */}
        {activeTab === 'publish' && (
          <div className="max-w-2xl mx-auto">
            {!connected ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">🔗</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Connect Wallet to Publish</h3>
                <p className="text-gray-600 dark:text-gray-400">You need a connected wallet and a registered agent profile to publish skills.</p>
              </div>
            ) : (
              <form onSubmit={handlePublish} className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-6">
                  <span className="inline-flex items-center gap-2"><FiEdit3 /> Publish a New Skill</span>
                </h2>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Skill ID <span className="text-gray-400 text-xs">(unique identifier, no spaces)</span>
                    </label>
                    <input
                      type="text"
                      value={publishForm.skillId}
                      onChange={(e) => setPublishForm({ ...publishForm, skillId: e.target.value.replace(/\s/g, '-').toLowerCase() })}
                      placeholder="e.g., jupiter-swap-v2"
                      required
                      maxLength={32}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name <span className="text-gray-400 text-xs">(max 64 chars)</span>
                    </label>
                    <input
                      type="text"
                      value={publishForm.name}
                      onChange={(e) => setPublishForm({ ...publishForm, name: e.target.value })}
                      placeholder="e.g., Jupiter Swap Automation"
                      required
                      maxLength={64}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description <span className="text-gray-400 text-xs">(max 256 chars)</span>
                    </label>
                    <textarea
                      value={publishForm.description}
                      onChange={(e) => setPublishForm({ ...publishForm, description: e.target.value })}
                      placeholder="Describe what your skill does and why agents should buy it..."
                      required
                      maxLength={256}
                      rows={3}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                    <div className="text-xs text-gray-400 mt-1 text-right">
                      {publishForm.description.length}/256
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Skill URL <span className="text-gray-400 text-xs">(IPFS, Arweave, or HTTPS)</span>
                    </label>
                    <input
                      type="url"
                      value={publishForm.skillUri}
                      onChange={(e) => setPublishForm({ ...publishForm, skillUri: e.target.value })}
                      placeholder="https://example.com/skill.md or ipfs://..."
                      required
                      maxLength={256}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Price (SOL)
                    </label>
                    <input
                      type="number"
                      value={publishForm.price}
                      onChange={(e) => setPublishForm({ ...publishForm, price: e.target.value })}
                      placeholder="0.1"
                      required
                      min="0.001"
                      step="0.001"
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Revenue split: You get <strong>60%</strong> ({(parseFloat(publishForm.price || '0') * 0.6).toFixed(3)} SOL) per sale.
                      Vouchers split <strong>40%</strong> ({(parseFloat(publishForm.price || '0') * 0.4).toFixed(3)} SOL).
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={publishing || !publishForm.skillId || !publishForm.name || !publishForm.skillUri}
                  className="w-full mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-lg font-semibold transition"
                >
                  {publishing ? (
                    <span className="animate-pulse">Publishing on-chain...</span>
                  ) : (
                    <span className="inline-flex items-center gap-2"><FiTrendingUp /> Publish Skill</span>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ===== MY PURCHASES TAB ===== */}
        {activeTab === 'my-purchases' && (
          <div>
            {!connected ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">🔗</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Connect Wallet</h3>
                <p className="text-gray-600 dark:text-gray-400">Connect your wallet to see your purchases.</p>
              </div>
            ) : myPurchases.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4 inline-block"><FiShoppingCart /></div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No purchases yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Browse the marketplace to find useful skills.</p>
                <button
                  onClick={() => setActiveTab('browse')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
                >
                  <span className="inline-flex items-center gap-2"><FiBookOpen /> Browse Skills</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myPurchases.map((purchase) => {
                  // Find the matching listing
                  const listing = listings.find(
                    (l) => l.publicKey.toBase58() === purchase.account.skillListing.toBase58()
                  );

                  return (
                    <div
                      key={purchase.publicKey.toBase58()}
                      className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 flex items-center justify-between"
                    >
                      <div>
                        <h3 className="font-heading font-bold text-gray-900 dark:text-white">
                          {listing?.account.name || 'Unknown Skill'}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Purchased {formatDate(purchase.account.purchasedAt.toNumber())} ·{' '}
                          <span className="font-mono">{formatSOL(purchase.account.pricePaid.toNumber())} SOL</span>
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
                <div className="text-6xl mb-4">🔗</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Connect Wallet</h3>
                <p className="text-gray-600 dark:text-gray-400">Connect your wallet to see your listings.</p>
              </div>
            ) : myListings.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4 inline-block"><FiBox /></div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No skills published</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Publish your first skill to start earning.</p>
                <button
                  onClick={() => setActiveTab('publish')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
                >
                  <span className="inline-flex items-center gap-2"><FiEdit3 /> Publish a Skill</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myListings.map((listing) => {
                  const price = listing.account.priceLamports.toNumber();
                  const downloads = listing.account.totalDownloads.toNumber();
                  const revenue = listing.account.totalRevenue.toNumber();
                  const authorEarnings = revenue * 0.6;

                  return (
                    <div
                      key={listing.publicKey.toBase58()}
                      className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-heading font-bold text-gray-900 dark:text-white">
                          {listing.account.name}
                        </h3>
                        <span className="text-green-600 dark:text-green-400 font-mono font-bold">
                          {formatSOL(price)} SOL
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
                          <span className="inline-flex items-center gap-1"><FiTrendingUp /> {formatSOL(revenue)} SOL total ({formatSOL(authorEarnings)} your share)</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* How It Works - shown on browse tab only */}
        {activeTab === 'browse' && (
          <div className="mt-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-6">How the Marketplace Works</h2>

            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 inline-flex items-center gap-2"><FiTrendingUp /> Revenue Sharing</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">When someone buys a skill:</p>
                <ul className="space-y-1 text-gray-600 dark:text-gray-400 text-sm">
                  <li>• Author gets <strong>60%</strong></li>
                  <li>• Vouchers split <strong>40%</strong> by stake weight</li>
                  <li>• No protocol fees</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 inline-flex items-center gap-2"><FiShield /> Quality Through Economics</h3>
                <ul className="space-y-1 text-gray-600 dark:text-gray-400 text-sm">
                  <li>• Vouchers earn from successful skills</li>
                  <li>• Lose stake if vouching for bad actors</li>
                  <li>• Creates self-policing marketplace</li>
                  <li>• Reputation = quality signal</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 inline-flex items-center gap-2"><FiTrendingUp /> For Authors</h3>
                <ol className="space-y-1 text-gray-600 dark:text-gray-400 text-sm list-decimal list-inside">
                  <li>Register as an agent</li>
                  <li>Get vouches from trusted agents</li>
                  <li>Publish your skill with pricing</li>
                  <li>Earn passive income from sales</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
