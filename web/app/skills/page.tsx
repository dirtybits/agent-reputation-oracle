"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useWalletConnection } from "@solana/react-hooks";
import { type Address } from "@solana/kit";
import Link from "next/link";
import { useReputationOracle } from "@/hooks/useReputationOracle";
import { getConfiguredSolanaExplorerTxUrl } from "@/lib/chains";
import {
  navButtonFlexClass,
  navButtonInlineClass,
  navButtonPrimaryFlexClass,
  navButtonPrimaryInlineClass,
  navButtonSizeClass,
} from "@/lib/buttonStyles";
import { formatSolAmount, fromLamports } from "@/lib/pricing";
import { SolAmount } from "@/components/SolAmount";
import TrustBadge, { type TrustData } from "@/components/TrustBadge";
import type {
  SkillListing,
  Purchase,
} from "../../generated/reputation-oracle/src/generated";
import {
  FiActivity,
  FiAlertTriangle,
  FiAward,
  FiBookOpen,
  FiBox,
  FiCheckCircle,
  FiClock,
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
} from "react-icons/fi";
import { isRpcRateLimitError } from "@/lib/rpcErrors";
import { getCompetitionPhase } from "@/lib/competition";
import type { PurchasePreflightStatus } from "@/lib/purchasePreflight";
import { getErrorMessage } from "@/lib/errors";

type PageTab = "browse" | "my-purchases" | "my-listings";

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
  total_revenue?: number;
  price_lamports?: number;
  on_chain_address?: string;
  skill_uri?: string | null;
  source?: "repo" | "chain";
  created_at: string;
  author_trust: TrustData | null;
  creatorPriceLamports?: number;
  estimatedPurchaseRentLamports?: number;
  feeBufferLamports?: number;
  estimatedBuyerTotalLamports?: number;
  purchasePreflightStatus?: PurchasePreflightStatus;
  purchasePreflightMessage?: string | null;
  priceDisclosure?: string | null;
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
  type: "purchase" | "listing";
  publicKey: Address;
  actor: Address;
  skillListing: Address;
  skillName: string;
  skillRepoId: string | null;
  author: Address;
  timestamp: number;
  priceLamports: number;
};

type SortOption = "newest" | "installs" | "trusted" | "name";

function formatSol(lamports: number): string {
  return formatSolAmount(lamports);
}

function shortAddr(addr: string): string {
  return addr.slice(0, 4) + "..." + addr.slice(-4);
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

function isBlockingPurchaseStatus(
  status: PurchasePreflightStatus | null | undefined
) {
  return (
    status === "buyerInsufficientBalance" ||
    status === "authorPayoutRentBlocked"
  );
}

function getCapabilityFallback(tags: string[]): string | null {
  if (!tags.length) return null;
  return `Capabilities: ${tags.slice(0, 3).join(", ")}`;
}

export default function MarketplacePage() {
  const { wallet, status } = useWalletConnection();
  const connected = status === "connected" && !!wallet;
  const publicKey = wallet?.account.address ?? null;
  const oracle = useReputationOracle();

  const [activeTab, setActiveTab] = useState<PageTab>("browse");

  // Browse state
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Marketplace state
  const [listings, setListings] = useState<SkillListingData[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchasedKeys, setPurchasedKeys] = useState<Set<string>>(new Set());
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [purchaseStatusReady, setPurchaseStatusReady] = useState(false);
  const [purchaseStatusWarning, setPurchaseStatusWarning] = useState<
    string | null
  >(null);

  // My data
  const [myPurchases, setMyPurchases] = useState<PurchaseData[]>([]);
  const [myListings, setMyListings] = useState<SkillListingData[]>([]);
  const [myListingDetails, setMyListingDetails] = useState<
    Map<string, SkillRow>
  >(new Map());
  const purchaseStateWalletRef = useRef<string | null>(null);

  // Feed state
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const purchasedSkillListingKeys = useMemo(
    () =>
      new Set([
        ...purchasedKeys,
        ...myPurchases.map((purchase) => String(purchase.account.skillListing)),
      ]),
    [myPurchases, purchasedKeys]
  );

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      params.set("sort", sort);
      params.set("page", String(page));
      if (publicKey) params.set("buyer", String(publicKey));

      const res = await fetch(`/api/skills?${params}`);
      if (!res.ok) throw new Error("Failed to fetch skills");
      const data: ApiResponse = await res.json();

      setSkills(data.skills);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      console.error("Error fetching skills:", err);
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, [page, publicKey, search, sort]);

  const loadFeed = useCallback(
    async (
      resolvedListings: SkillListingData[],
      repoMap: Map<string, string>
    ) => {
      setFeedLoading(true);
      try {
        const purchases = await oracle.getAllPurchases();
        const listingMap = new Map(
          resolvedListings.map((l) => [l.publicKey as string, l])
        );
        const purchaseItems: FeedItem[] = purchases.map((p) => {
          const listing = listingMap.get(p.account.skillListing as string);
          return {
            type: "purchase",
            publicKey: p.publicKey,
            actor: p.account.buyer,
            skillListing: p.account.skillListing,
            skillName: listing?.account.name ?? "Unknown Skill",
            skillRepoId: repoMap.get(p.account.skillListing as string) ?? null,
            author: listing?.account.author ?? ("" as Address),
            timestamp: Number(p.account.purchasedAt),
            priceLamports: Number(p.account.pricePaid),
          };
        });
        const listingItems: FeedItem[] = resolvedListings.map((listing) => ({
          type: "listing",
          publicKey: listing.publicKey,
          actor: listing.account.author,
          skillListing: listing.publicKey,
          skillName: listing.account.name,
          skillRepoId: repoMap.get(listing.publicKey as string) ?? null,
          author: listing.account.author,
          timestamp: Number(listing.account.createdAt),
          priceLamports: Number(listing.account.priceLamports),
        }));
        const items: FeedItem[] = [...purchaseItems, ...listingItems]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 20);
        setFeedItems(items);
      } catch (e) {
        console.error("Failed to load feed:", e);
      } finally {
        setFeedLoading(false);
      }
    },
    [oracle]
  );

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
      setListings(all);
      void loadFeed(all, repoMap);
    } catch (e) {
      console.error("Failed to load listings:", e);
    }
  }, [loadFeed, oracle]);

  const loadMyData = useCallback(async () => {
    if (!publicKey) {
      setMyPurchases([]);
      setMyListings([]);
      setMyListingDetails(new Map());
      setPurchasedKeys(new Set());
      setPurchaseStatusReady(false);
      setPurchaseStatusWarning(null);
      purchaseStateWalletRef.current = null;
      return;
    }
    try {
      const [purchases, authorListings, authoredSkillsResponse] =
        await Promise.all([
          oracle.getPurchasesByBuyer(publicKey),
          oracle.getSkillListingsByAuthor(publicKey),
          fetch(
            `/api/skills?author=${encodeURIComponent(
              String(publicKey)
            )}&sort=newest`
          ),
        ]);
      const authoredSkillsData: ApiResponse | null = authoredSkillsResponse.ok
        ? await authoredSkillsResponse.json()
        : null;
      setMyPurchases(purchases);
      setMyListings(authorListings);
      setMyListingDetails(
        new Map(
          (authoredSkillsData?.skills ?? [])
            .filter((skill) => !!skill.on_chain_address)
            .map((skill) => [String(skill.on_chain_address), skill])
        )
      );
      setPurchasedKeys(
        new Set(purchases.map((p) => String(p.account.skillListing)))
      );
      setPurchaseStatusReady(true);
      setPurchaseStatusWarning(null);
      purchaseStateWalletRef.current = String(publicKey);
    } catch (e) {
      console.error("Failed to load user data:", e);
      if (purchaseStateWalletRef.current !== String(publicKey)) {
        setMyPurchases([]);
        setMyListings([]);
        setMyListingDetails(new Map());
        setPurchasedKeys(new Set());
      }
      setPurchaseStatusWarning(
        isRpcRateLimitError(e)
          ? "Purchase status is temporarily unavailable because the RPC is rate-limiting requests."
          : "Purchase status could not be refreshed right now."
      );
    }
  }, [oracle, publicKey]);

  const refreshPurchasedFlags = useCallback(async () => {
    if (!publicKey || listings.length === 0) {
      if (!publicKey) setPurchasedKeys(new Set());
      return;
    }

    try {
      const purchasedListingKeys = await oracle.getPurchasedSkillListingKeys(
        publicKey,
        listings.map((listing) => listing.publicKey)
      );
      setPurchasedKeys((prev) => new Set([...prev, ...purchasedListingKeys]));
      setPurchaseStatusReady(true);
      setPurchaseStatusWarning(null);
      purchaseStateWalletRef.current = String(publicKey);
    } catch (error) {
      console.error("Failed to resolve purchased listing flags:", error);
      if (!purchaseStatusReady && purchasedSkillListingKeys.size === 0) {
        setPurchaseStatusWarning(
          isRpcRateLimitError(error)
            ? "Purchase status is temporarily unavailable because the RPC is rate-limiting requests."
            : "Purchase status could not be refreshed right now."
        );
      }
    }
  }, [
    listings,
    oracle,
    publicKey,
    purchaseStatusReady,
    purchasedSkillListingKeys.size,
  ]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);
  useEffect(() => {
    loadListings();
  }, [loadListings]);
  useEffect(() => {
    loadMyData();
  }, [loadMyData]);
  useEffect(() => {
    refreshPurchasedFlags();
  }, [refreshPurchasedFlags]);

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
      const { tx, alreadyPurchased } = await oracle.purchaseSkill(
        listingPubkey,
        authorKey
      );
      if (alreadyPurchased) {
        setPurchasedKeys((prev) => new Set([...prev, String(listingPubkey)]));
        setPurchaseStatusReady(true);
        setPurchaseStatusWarning(null);
        setTxSuccess("Already purchased with this wallet.");
      } else if (tx) {
        setPurchasedKeys((prev) => new Set([...prev, String(listingPubkey)]));
        setPurchaseStatusReady(true);
        setPurchaseStatusWarning(null);
        setTxSuccess(tx);
      }
      await Promise.all([loadListings(), loadMyData()]);
    } catch (error: unknown) {
      console.error("Purchase failed:", error);
      setTxError(getErrorMessage(error, "Transaction failed"));
    } finally {
      setPurchasing(null);
    }
  };

  const getListingForSkill = (
    skill: SkillRow
  ): SkillListingData | undefined => {
    if (skill.on_chain_address) {
      return listings.find(
        (l) => (l.publicKey as string) === skill.on_chain_address
      );
    }
    return undefined;
  };

  const sortOptions: {
    value: SortOption;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      value: "newest",
      label: "Newest",
      icon: <FiClock className="w-3.5 h-3.5" />,
    },
    {
      value: "trusted",
      label: "Most Trusted",
      icon: <FiShield className="w-3.5 h-3.5" />,
    },
    {
      value: "installs",
      label: "Most Installed",
      icon: <FiTrendingUp className="w-3.5 h-3.5" />,
    },
    {
      value: "name",
      label: "Name",
      icon: <FiBookOpen className="w-3.5 h-3.5" />,
    },
  ];

  const tabs: { key: PageTab; label: string; icon: ReactNode }[] = [
    {
      key: "browse",
      label: "Browse",
      icon: <FiBookOpen className="inline-block mr-1" />,
    },
    {
      key: "my-purchases",
      label: "My Purchases",
      icon: <FiShoppingCart className="inline-block mr-1" />,
    },
    {
      key: "my-listings",
      label: "My Listings",
      icon: <FiPackage className="inline-block mr-1" />,
    },
  ];

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 dark:text-white mb-1">
              Skills Marketplace
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Browse AI agent skills with on-chain author trust context. Inspect
              stake, peer vouches, and dispute history before you install or
              pay.
              {total > 0 && activeTab === "browse" && (
                <span className="ml-2 text-gray-400">({total} skills)</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/competition"
              className={`${navButtonFlexClass} font-semibold bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800 hover:border-yellow-300 dark:hover:border-yellow-700 transition`}
            >
              <FiAward className="w-4 h-4" />
              <span className="hidden sm:inline">Competition</span>
              <span className="hidden sm:inline px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-yellow-200 dark:bg-yellow-800/40">
                {getCompetitionPhase() === "upcoming"
                  ? "Mar 11"
                  : getCompetitionPhase() === "active"
                  ? "Live"
                  : "Ended"}
              </span>
            </Link>
            <Link href="/skills/publish" className={navButtonPrimaryFlexClass}>
              <FiPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Publish Skill</span>
              <span className="sm:hidden">Publish</span>
            </Link>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-sm text-gray-600 dark:text-gray-300">
          AgentVouch does not just list skills. It helps you evaluate the agent
          behind them. New here? Read{" "}
          <Link
            href="/docs/what-is-an-agent-reputation-oracle"
            className="text-[var(--lobster-accent)] hover:underline"
          >
            what an agent reputation oracle is
          </Link>{" "}
          or{" "}
          <Link
            href="/docs/verify-ai-agents"
            className="text-[var(--lobster-accent)] hover:underline"
          >
            how to verify an AI agent before delegation
          </Link>
          .
        </div>

        {/* Toast notifications */}
        {txSuccess && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-green-600 dark:text-green-400">
                <FiCheckCircle />
              </span>
              <span className="text-green-800 dark:text-green-200 text-sm">
                Transaction confirmed:{" "}
                <a
                  href={getConfiguredSolanaExplorerTxUrl(txSuccess)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-mono"
                >
                  {shortAddr(txSuccess)}
                </a>
              </span>
            </div>
            <button
              onClick={() => setTxSuccess(null)}
              className="text-green-600 dark:text-green-400 hover:text-green-800"
            >
              ✕
            </button>
          </div>
        )}
        {txError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-red-600 dark:text-red-400">
                <FiXCircle />
              </span>
              <span className="text-red-800 dark:text-red-200 text-sm">
                {txError}
              </span>
            </div>
            <button
              onClick={() => setTxError(null)}
              className="text-red-600 dark:text-red-400 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        )}
        {purchaseStatusWarning && connected && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2">
            <span className="mt-0.5 text-amber-600 dark:text-amber-400">
              <FiAlertTriangle />
            </span>
            <span className="text-amber-800 dark:text-amber-200 text-sm">
              {purchaseStatusWarning} Purchased badges may be incomplete until
              the status refresh succeeds.
            </span>
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
                  ? "border-[var(--sea-accent)] text-[var(--sea-accent-strong)]"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-[var(--sea-accent)]"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ===== BROWSE TAB ===== */}
        {activeTab === "browse" && (
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
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sea-focus-ring)] focus:border-[var(--sea-accent)] transition"
                  />
                </form>
                <div className="flex items-center gap-2">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setSort(opt.value);
                        setPage(1);
                      }}
                      className={`${navButtonFlexClass} font-medium ${
                        sort === opt.value
                          ? "bg-[var(--sea-accent-soft)] text-[var(--sea-accent-strong)] border border-[var(--sea-accent-border)]"
                          : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
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
                  <p className="text-gray-500 dark:text-gray-400 mb-2">
                    No skills found
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    {search
                      ? "Try a different search term"
                      : "Be the first to publish a skill"}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {skills.map((skill) => {
                      const downloads =
                        (skill.total_installs ?? 0) +
                        (skill.total_downloads ?? 0);
                      const listing = getListingForSkill(skill);
                      const hasPurchased = listing
                        ? purchasedSkillListingKeys.has(
                            String(listing.publicKey)
                          )
                        : false;
                      const isOwn =
                        publicKey &&
                        skill.author_pubkey === (publicKey as string);
                      const isPurchasing = listing
                        ? purchasing === (listing.publicKey as string)
                        : false;
                      const creatorPrice =
                        skill.creatorPriceLamports ??
                        (listing
                          ? Number(listing.account.priceLamports)
                          : skill.price_lamports ?? 0);
                      const estimatedTotal =
                        skill.estimatedBuyerTotalLamports ?? creatorPrice;
                      const purchasePreflightStatus =
                        skill.purchasePreflightStatus ??
                        (creatorPrice > 0 ? "estimateUnavailable" : "ok");
                      const purchaseBlocked =
                        creatorPrice > 0 &&
                        isBlockingPurchaseStatus(purchasePreflightStatus);
                      const purchaseMessage = skill.purchasePreflightMessage;
                      return (
                        <div
                          key={skill.id}
                          className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:border-gray-300 dark:hover:border-gray-700 transition flex flex-col"
                        >
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-3">
                              <Link
                                href={`/skills/${skill.id}`}
                                className="text-base font-bold text-gray-900 dark:text-white group-hover:text-[var(--lobster-accent)] transition hover:underline"
                              >
                                {skill.name}
                              </Link>
                              <div className="flex items-center gap-2 shrink-0">
                                {creatorPrice > 0 ? (
                                  <div className="flex flex-col items-end">
                                    <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold">
                                      <SolAmount
                                        amount={formatSol(estimatedTotal)}
                                        iconClassName="w-3 h-3"
                                      />
                                    </span>
                                    <span className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                                      Creator{" "}
                                      {fromLamports(creatorPrice).toFixed(3)}{" "}
                                      SOL
                                    </span>
                                  </div>
                                ) : (
                                  listing && (
                                    <span className="px-2 py-0.5 rounded-full bg-[var(--sea-accent-soft)] text-[var(--sea-accent-strong)] text-xs font-semibold">
                                      Free
                                    </span>
                                  )
                                )}
                                {skill.source !== "chain" && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                                    v{skill.current_version}
                                  </span>
                                )}
                              </div>
                            </div>

                            {skill.description ? (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                                {skill.description}
                              </p>
                            ) : getCapabilityFallback(skill.tags ?? []) ? (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                                {getCapabilityFallback(skill.tags ?? [])}
                              </p>
                            ) : null}

                            {creatorPrice > 0 && (
                              <div
                                className={`mb-3 rounded-lg border p-3 ${
                                  purchaseBlocked
                                    ? "border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/10"
                                    : "border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40"
                                }`}
                              >
                                <div className="flex items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-300">
                                  <span>Estimated total</span>
                                  <span className="font-mono text-gray-900 dark:text-white">
                                    <SolAmount
                                      amount={formatSol(estimatedTotal)}
                                      iconClassName="w-3 h-3"
                                    />
                                  </span>
                                </div>
                                {estimatedTotal !== creatorPrice && (
                                  <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                                    <span>Creator price</span>
                                    <span className="font-mono">
                                      <SolAmount
                                        amount={formatSol(creatorPrice)}
                                        iconClassName="w-3 h-3"
                                      />
                                    </span>
                                  </div>
                                )}
                                {purchaseMessage && (
                                  <p
                                    className={`mt-2 text-[11px] leading-relaxed ${
                                      purchaseBlocked
                                        ? "text-amber-700 dark:text-amber-300"
                                        : "text-gray-500 dark:text-gray-400"
                                    }`}
                                  >
                                    {purchaseMessage}
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="mb-3">
                              <TrustBadge trust={skill.author_trust} compact />
                              <p className="mt-2 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                                Reputation, vouches, staked SOL, and dispute
                                history help signal author trust.
                              </p>
                              <Link
                                href={`/author/${skill.author_pubkey}`}
                                className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--sea-accent)] hover:text-[var(--sea-accent-strong)] hover:underline"
                                title={skill.author_pubkey}
                              >
                                View author trust{" "}
                                <FiExternalLink className="w-3 h-3" />
                              </Link>
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
                                    {skill.tags.slice(0, 2).join(", ")}
                                  </span>
                                )}
                              </div>
                              <Link
                                href={`/author/${skill.author_pubkey}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-mono hover:text-[var(--sea-accent)] hover:underline transition"
                                title={skill.author_pubkey}
                              >
                                {shortAddr(skill.author_pubkey)}
                              </Link>
                            </div>

                            {skill.ipfs_cid && (
                              <div className="mt-2 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                                <FiShield className="w-3 h-3" />
                                <span
                                  className="font-mono truncate"
                                  title={skill.ipfs_cid}
                                >
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
                              className="mt-2 flex items-center gap-1 text-xs text-[var(--sea-accent)] hover:text-[var(--sea-accent-strong)] hover:underline truncate"
                            >
                              <FiExternalLink className="w-3 h-3 shrink-0" />
                              <span className="truncate">
                                {skill.skill_uri}
                              </span>
                            </a>
                          )}

                          {/* Purchase / View action for on-chain skills */}
                          {listing && (
                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                              {isOwn ? (
                                <div
                                  className={`w-full ${navButtonSizeClass} bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 font-medium text-center border border-gray-200 dark:border-gray-700`}
                                >
                                  Your Skill
                                </div>
                              ) : creatorPrice === 0 ? (
                                <Link
                                  href={`/skills/${skill.id}`}
                                  className={`w-full ${navButtonFlexClass} font-medium bg-[var(--sea-accent-soft)] text-[var(--sea-accent-strong)] text-center border border-[var(--sea-accent-border)] hover:bg-[var(--sea-accent-soft-hover)] transition`}
                                >
                                  <FiDownload className="w-3 h-3" /> Free — View
                                  & Install
                                </Link>
                              ) : hasPurchased ? (
                                <div
                                  className={`w-full ${navButtonSizeClass} bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium text-center border border-green-200 dark:border-green-800`}
                                >
                                  <span className="inline-flex items-center gap-1">
                                    <FiCheckCircle className="w-3 h-3" />{" "}
                                    Purchased
                                  </span>
                                </div>
                              ) : purchaseBlocked ? (
                                <div
                                  className={`w-full ${navButtonSizeClass} bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-medium text-center border border-amber-200 dark:border-amber-800`}
                                >
                                  {purchasePreflightStatus ===
                                  "authorPayoutRentBlocked"
                                    ? "Seller Needs SOL"
                                    : "Need More SOL"}
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handlePurchase(
                                      listing.publicKey,
                                      listing.account.author
                                    );
                                  }}
                                  disabled={!connected || isPurchasing}
                                  className={`w-full ${navButtonPrimaryFlexClass}`}
                                >
                                  {isPurchasing ? (
                                    <span className="animate-pulse">
                                      Processing...
                                    </span>
                                  ) : connected ? (
                                    <span className="inline-flex items-center gap-1 justify-center">
                                      Buy (~{" "}
                                      <SolAmount
                                        amount={formatSol(estimatedTotal)}
                                        iconClassName="w-3 h-3"
                                      />
                                      )
                                    </span>
                                  ) : (
                                    "Connect Wallet to Buy"
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
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Recent Activity
                  </span>
                  {feedLoading && (
                    <span className="ml-auto">
                      <FiLoader className="w-3 h-3 text-gray-400 animate-spin" />
                    </span>
                  )}
                </div>

                {feedItems.length === 0 && !feedLoading ? (
                  <div className="px-4 py-8 text-center">
                    <FiClock className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-700" />
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      No recent activity yet.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-50 dark:divide-gray-800/50 max-h-[520px] overflow-y-auto">
                    {feedItems.map((item) => (
                      <li
                        key={item.publicKey}
                        className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                      >
                        <p className="text-xs text-gray-900 dark:text-gray-100 leading-relaxed">
                          <Link
                            href={`/author/${item.actor}`}
                            className="font-mono font-medium text-[var(--sea-accent)] hover:text-[var(--sea-accent-strong)] hover:underline"
                          >
                            {shortAddr(item.actor)}
                          </Link>{" "}
                          {item.type === "listing" ? "listed " : "bought "}
                          {item.skillRepoId ? (
                            <Link
                              href={`/skills/${item.skillRepoId}`}
                              className="font-semibold text-gray-900 dark:text-white hover:text-[var(--sea-accent)] transition"
                            >
                              &ldquo;{item.skillName}&rdquo;
                            </Link>
                          ) : (
                            <span className="font-semibold text-gray-900 dark:text-white">
                              &ldquo;{item.skillName}&rdquo;
                            </span>
                          )}{" "}
                          {item.type === "purchase" && item.author ? (
                            <>
                              from{" "}
                              <Link
                                href={`/author/${item.author}`}
                                className="font-mono font-medium text-[var(--sea-accent)] hover:text-[var(--sea-accent-strong)] hover:underline"
                              >
                                {shortAddr(item.author)}
                              </Link>
                            </>
                          ) : null}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400 dark:text-gray-500 inline-flex items-center gap-1">
                            <FiClock className="w-3 h-3" />
                            {timeAgo(item.timestamp)}
                          </span>
                          {item.priceLamports > 0 && (
                            <span className="text-xs font-mono text-green-600 dark:text-green-400">
                              <SolAmount
                                amount={formatSol(item.priceLamports)}
                                iconClassName="w-3 h-3"
                              />
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
        {activeTab === "my-purchases" && (
          <div>
            {!connected ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-2xl text-gray-400 dark:text-gray-500">
                  <FiShoppingCart />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Connect Wallet
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Connect your wallet to see your purchases.
                </p>
              </div>
            ) : myPurchases.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-2xl text-gray-400 dark:text-gray-500">
                  <FiShoppingCart />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  No purchases yet
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Browse the marketplace to find useful skills.
                </p>
                <button
                  onClick={() => setActiveTab("browse")}
                  className={navButtonPrimaryInlineClass}
                >
                  <span className="inline-flex items-center gap-2">
                    <FiBookOpen /> Browse Skills
                  </span>
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
                          {listing?.account.name || "Unknown Skill"}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Purchased{" "}
                          {formatDate(Number(purchase.account.purchasedAt))} ·{" "}
                          <SolAmount
                            amount={formatSol(
                              Number(purchase.account.pricePaid)
                            )}
                            className="font-mono text-gray-900 dark:text-white"
                            iconClassName="w-3 h-3"
                          />
                        </p>
                      </div>
                      {listing?.account.skillUri && (
                        <a
                          href={listing.account.skillUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${navButtonInlineClass} font-semibold bg-green-600 hover:bg-green-700 text-white transition`}
                        >
                          <span className="inline-flex items-center gap-1">
                            <FiDownload /> Download
                          </span>
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
        {activeTab === "my-listings" && (
          <div>
            {!connected ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-2xl text-gray-400 dark:text-gray-500">
                  <FiBox />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Connect Wallet
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Connect your wallet to see your listings.
                </p>
              </div>
            ) : myListings.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-2xl text-gray-400 dark:text-gray-500">
                  <FiBox />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  No skills published
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Publish your first skill to start earning.
                </p>
                <Link
                  href="/skills/publish"
                  className={navButtonPrimaryInlineClass}
                >
                  <FiPlus /> Publish a Skill
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {myListings.map((listing) => {
                  const listingDetail = myListingDetails.get(
                    String(listing.publicKey)
                  );
                  const price = Number(listing.account.priceLamports);
                  const downloads = Number(listing.account.totalDownloads);
                  const revenue = Number(listing.account.totalRevenue);
                  const authorEarnings = revenue * 0.6;
                  const sellerRentBlocked =
                    listingDetail?.purchasePreflightStatus ===
                    "authorPayoutRentBlocked";
                  const estimatedBuyerTotal =
                    listingDetail?.estimatedBuyerTotalLamports ?? price;

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
                          <SolAmount
                            amount={formatSol(price)}
                            iconClassName="w-3.5 h-3.5"
                          />
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {listing.account.description}
                      </p>
                      {sellerRentBlocked && (
                        <div className="mb-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                          <div className="flex items-start gap-2">
                            <FiAlertTriangle className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                Low-priced sales are currently blocked
                              </p>
                              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                                {listingDetail?.purchasePreflightMessage}
                              </p>
                              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                                Buyers currently see an estimated total of{" "}
                                {formatSol(estimatedBuyerTotal)} SOL, but
                                purchases will fail until this payout wallet
                                holds enough SOL.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-4 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          <span className="inline-flex items-center gap-1">
                            <FiDownload /> {downloads} downloads
                          </span>
                        </span>
                        <span className="text-green-600 dark:text-green-400 font-mono">
                          <span className="inline-flex items-center gap-1">
                            <FiTrendingUp /> {formatSol(revenue)} SOL total (
                            {formatSol(authorEarnings)} your share)
                          </span>
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
