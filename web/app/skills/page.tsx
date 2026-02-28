'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ClientWalletButton } from '@/components/ClientWalletButton';
import TrustBadge, { type TrustData } from '@/components/TrustBadge';
import {
  FiSearch,
  FiDownload,
  FiDollarSign,
  FiTag,
  FiClock,
  FiTrendingUp,
  FiShield,
  FiLoader,
  FiBookOpen,
  FiCopy,
  FiPlus,
  FiAward,
} from 'react-icons/fi';

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

type SortOption = 'newest' | 'installs' | 'trusted' | 'name';

function formatSol(lamports: number): string {
  return (lamports / 1e9).toFixed(2);
}

function shortAddr(addr: string): string {
  return addr.slice(0, 4) + '...' + addr.slice(-4);
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

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

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchSkills();
  };

  const sortOptions: { value: SortOption; label: string; icon: React.ReactNode }[] = [
    { value: 'newest', label: 'Newest', icon: <FiClock className="w-3.5 h-3.5" /> },
    { value: 'trusted', label: 'Most Trusted', icon: <FiShield className="w-3.5 h-3.5" /> },
    { value: 'installs', label: 'Most Installed', icon: <FiTrendingUp className="w-3.5 h-3.5" /> },
    { value: 'name', label: 'Name', icon: <FiBookOpen className="w-3.5 h-3.5" /> },
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
              <span className="text-sm font-medium text-gray-900 dark:text-white">Skill Repository</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 dark:text-white mb-1">
              Skill Repository
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Browse verified AI agent skills. Every skill shows author trust signals.
              {total > 0 && <span className="ml-2 text-gray-400">({total} skills)</span>}
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

        {/* Content */}
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
                const href = skill.source === 'chain'
                  ? '/marketplace'
                  : `/skills/${skill.id}`;
                const downloads = (skill.total_installs ?? 0) + (skill.total_downloads ?? 0);

                return (
                  <Link
                    key={skill.id}
                    href={href}
                    className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:border-gray-300 dark:hover:border-gray-700 transition"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                        {skill.name}
                      </h3>
                      <div className="flex items-center gap-2 shrink-0">
                        {skill.price_lamports != null && skill.price_lamports > 0 && (
                          <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold">
                            <FiDollarSign className="w-3 h-3" />
                            {formatSol(skill.price_lamports)} SOL
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

                    {/* Trust signals */}
                    <div className="mb-3">
                      <TrustBadge trust={skill.author_trust} compact />
                    </div>

                    {/* Meta */}
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
                        {skill.source === 'chain' && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-medium">
                            On-chain
                          </span>
                        )}
                      </div>
                      <span className="font-mono" title={skill.author_pubkey}>
                        {shortAddr(skill.author_pubkey)}
                      </span>
                    </div>

                    {/* IPFS CID */}
                    {skill.ipfs_cid && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                        <FiShield className="w-3 h-3" />
                        <span className="font-mono truncate" title={skill.ipfs_cid}>
                          {skill.ipfs_cid.slice(0, 12)}...
                        </span>
                      </div>
                    )}
                  </Link>
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
    </main>
  );
}
