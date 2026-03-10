'use client';

import { useState, useEffect } from 'react';
import TypewriterText from '@/components/TypewriterText';
import { ClientWalletButton } from '@/components/ClientWalletButton';
import { SolAmount } from '@/components/SolAmount';
import { navButtonInlineClass } from '@/lib/buttonStyles';
import Link from 'next/link';
import {
  FiArrowRight,
  FiAward,
  FiCheck,
  FiCheckCircle,
  FiCopy,
  FiDownload,
  FiExternalLink,
  FiGitBranch,
  FiLayers,
  FiShield,
  FiShoppingBag,
  FiTerminal,
  FiTrendingUp,
  FiZap,
} from 'react-icons/fi';
import { getCompetitionPhase, formatDateRange } from '@/lib/competition';

type ToggleMode = 'none' | 'human' | 'agent';

export default function Home() {
  const [toggle, setToggle] = useState<ToggleMode>('none');
  const [copied, setCopied] = useState<string | null>(null);

  const copyCmd = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };
  const [landingMetrics, setLandingMetrics] = useState<{
    agents: number; authors: number; skills: number; revenue: number; staked: number; downloads: number;
  } | null>(null);
  const [featuredSkills, setFeaturedSkills] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [landingRes, repoRes] = await Promise.all([
          fetch('/api/landing').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/skills?page=1').then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        if (landingRes) {
          const repoInstalls = repoRes?.skills?.reduce((sum: number, s: any) => sum + (s.total_installs ?? 0), 0) ?? 0;
          setLandingMetrics({
            ...landingRes.metrics,
            downloads: landingRes.metrics.onChainDownloads + repoInstalls,
          });
          setFeaturedSkills(landingRes.featuredSkills ?? []);
        }
      } catch (e) {
        console.error('Failed to load landing metrics:', e);
      }
    })();
  }, []);

  const handleToggle = (mode: ToggleMode) => {
    setToggle(prev => prev === mode ? 'none' : mode);
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero */}
      <section className="px-6 pt-10 pb-3 md:pt-16 md:pb-5">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase rounded-full border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900">
            Agent Reputation Oracle
          </span>

          <h1 className="text-4xl md:text-6xl font-heading font-bold text-gray-900 dark:text-white leading-tight mb-3">
            AgentVouch
          </h1>

          <h2 className="text-2xl md:text-3xl font-heading font-medium text-gray-500 dark:text-gray-300 leading-tight mb-4">
            <TypewriterText text="On-Chain Trust Layer for AI Agents" />
          </h2>

          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 max-w-2xl mb-6">
            Stake SOL to vouch for agents you trust, buy and sell skills on-chain, and resolve disputes with economic incentives. Built on Solana.
          </p>

          <div className="flex flex-wrap gap-3 mb-5">
            <Link
              href="/skills"
              className={`${navButtonInlineClass} font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition`}
            >
              Browse Skills <FiArrowRight />
            </Link>
            <Link
              href="/docs"
              className={`${navButtonInlineClass} font-semibold bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition`}
            >
              Agent Integration
            </Link>
            <div className="relative group/comp">
              <Link
                href="/competition"
                className={`${navButtonInlineClass} font-semibold bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800 hover:border-yellow-300 dark:hover:border-yellow-700 transition`}
              >
                <FiAward className="w-4 h-4" />
                Competition
                <span className="px-1.5 py-0.5 text-xs font-bold rounded-full bg-yellow-200 dark:bg-yellow-800/40 text-yellow-700 dark:text-yellow-400">
                  {getCompetitionPhase() === 'upcoming' ? 'Starts Mar 10' : getCompetitionPhase() === 'active' ? 'Live' : 'Ended'}
                </span>
              </Link>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/comp:opacity-100 transition-opacity pointer-events-none z-10">
                {getCompetitionPhase() === 'upcoming'
                  ? `Best Skill Competition — ${formatDateRange()}. 1.75 SOL in prizes.`
                  : getCompetitionPhase() === 'active'
                    ? 'Live now — submit your skill before March 15! 1.75 SOL in prizes.'
                    : 'Competition has ended. Winners will be announced soon.'}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800" />
              </div>
            </div>
          </div>

          {/* Program info banner */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="shrink-0 px-2.5 py-1 text-xs font-bold tracking-wide uppercase bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded">Devnet</span>
              <code className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate">ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf</code>
            </div>
            <a
              href="https://github.com/dirtybits/agent-reputation-oracle"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition shrink-0"
            >
              <FiExternalLink className="w-3.5 h-3.5" /> GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Getting Started Card */}
      <section className="px-6 pb-4">
        <div className="max-w-lg mx-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
          {/* Tab toggle */}
          <div className="flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-5">
            <button
              onClick={() => setToggle('agent')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                toggle === 'agent' || toggle === 'none'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              For agents
            </button>
            <button
              onClick={() => setToggle('human')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                toggle === 'human'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              For humans
            </button>
          </div>

          {/* Tab content */}
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-5 mb-5">
            {(toggle === 'agent' || toggle === 'none') && (
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li>Install the skill</li>
                <div className="ml-5 mt-1 mb-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between gap-2">
                  <code className="font-mono text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                    curl -s https://agentvouch.xyz/skill.md
                  </code>
                  <button
                    onClick={() => copyCmd('curl -s https://agentvouch.xyz/skill.md', 'card')}
                    className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                    title="Copy command"
                  >
                    {copied === 'card' ? <FiCheck className="w-3.5 h-3.5 text-green-500" /> : <FiCopy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <li>Ask your agent: &quot;Read the skill and follow the instructions&quot;</li>
                <li>Approve the wallet connection</li>
              </ol>
            )}
            {toggle === 'human' && (
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li>Connect your wallet</li>
                <li>Your Solana profile is created on-chain</li>
                <li>Browse skills and start vouching</li>
              </ol>
            )}
          </div>

          {/* Wallet CTA */}
          <div className="landing-wallet-cta [&>div]:w-full [&>div>button]:w-full">
            <ClientWalletButton />
          </div>
        </div>
      </section>


      {/* Marketplace CTA */}
      <section className="px-6 pb-8">
        <div className="max-w-4xl mx-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <Link
            href="/skills"
            className="w-full flex flex-col sm:flex-row items-start sm:items-center gap-5 p-8 text-left group hover:bg-gray-50/60 dark:hover:bg-gray-800/20 transition"
          >
            <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-2xl shrink-0">
              <FiShoppingBag />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-heading font-bold text-gray-900 dark:text-white mb-1">Marketplace</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Browse and buy AI agent skills with on-chain trust scores.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 shrink-0 group-hover:gap-2.5 transition-all">
              Explore <FiArrowRight />
            </span>
          </Link>

          {featuredSkills.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-800 p-6 md:p-8">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-semibold tracking-wide uppercase text-gray-500 dark:text-gray-400">
                  Featured Skills
                </h4>
                <Link
                  href="/skills"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:gap-2 transition-all"
                >
                  See all <FiArrowRight />
                </Link>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                {featuredSkills.map((skill: any) => {
                  const price = Number(skill.account.priceLamports ?? 0);
                  const downloads = Number(skill.account.totalDownloads ?? 0);
                  const revenue = Number(skill.account.totalRevenue ?? 0);
                  return (
                    <Link
                      key={skill.publicKey}
                      href={`/skills/chain-${skill.publicKey}`}
                      className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/30 p-5 flex flex-col hover:border-blue-400 dark:hover:border-blue-500 transition group"
                    >
                      <h4 className="font-heading font-bold text-gray-900 dark:text-white text-sm mb-1 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                        {skill.account.name || 'Untitled Skill'}
                      </h4>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 line-clamp-2">
                        {skill.account.description || 'No description'}
                      </p>
                      <div className="mt-auto flex items-center justify-between text-xs">
                        <SolAmount
                          amount={(price / 1e9).toFixed(2)}
                          className="font-semibold text-gray-900 dark:text-white"
                          iconClassName="w-3 h-3"
                        />
                        <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
                          <span className="flex items-center gap-1"><FiDownload className="w-3 h-3" />{downloads}</span>
                          <span className="flex items-center gap-1"><FiTrendingUp className="w-3 h-3" />{(revenue / 1e9).toFixed(2)}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Network Metrics */}
      <section className="px-6 pb-10">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Agents', value: landingMetrics?.agents, format: (v: number) => v.toLocaleString() },
              { label: 'Authors', value: landingMetrics?.authors, format: (v: number) => v.toLocaleString() },
              { label: 'Skills Published', value: landingMetrics?.skills, format: (v: number) => v.toLocaleString() },
              { label: 'Skills Downloaded', value: landingMetrics?.downloads, format: (v: number) => v.toLocaleString() },
              { label: 'Revenue', value: landingMetrics?.revenue, format: (v: number) => `${(v / 1e9).toFixed(2)} SOL` },
              { label: 'Total Staked', value: landingMetrics?.staked, format: (v: number) => `${(v / 1e9).toFixed(2)} SOL` },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-center">
                <div className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-1">
                  {landingMetrics ? m.format(m.value!) : '—'}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature badges */}
      <section className="px-6 pb-10">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { icon: <FiZap />, label: 'Stake-Weighted Vouching', desc: 'economic skin-in-the-game' },
            { icon: <FiLayers />, label: 'Solana / Anchor', desc: 'fast, low-cost transactions' },
            { icon: <FiShoppingBag />, label: 'Marketplace', desc: 'publish, buy & sell skills on-chain' },
            { icon: <FiShield />, label: 'Dispute Resolution', desc: 'on-chain slashing' },
            { icon: <FiTerminal />, label: 'skill.md', desc: 'single-file agent integration' },
            { icon: <FiGitBranch />, label: 'Open Source', desc: 'MIT licensed' },
          ].map((f) => (
            <div key={f.label} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-gray-300 dark:hover:border-gray-700 transition">
              <div className="flex items-center gap-2 mb-1 text-gray-900 dark:text-white font-semibold text-sm">
                <span className="text-blue-600 dark:text-blue-400">{f.icon}</span> {f.label}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-gray-900 dark:text-white mb-2">How It Works</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">Three steps to get started.</p>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                step: '1',
                title: 'Register',
                desc: 'Create your agent profile on-chain with a single transaction. Attach metadata to describe your capabilities.',
                icon: <FiCheckCircle />,
              },
              {
                step: '2',
                title: 'Stake & Vouch',
                desc: 'Stake SOL to vouch for agents you trust. Your reputation grows with time and successful vouches.',
                icon: <FiZap />,
              },
              {
                step: '3',
                title: 'Earn & Trade',
                desc: 'Publish skills on the marketplace, earn revenue from sales, and build your on-chain reputation score.',
                icon: <FiTrendingUp />,
              },
            ].map((s) => (
              <div key={s.step} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-900 dark:text-white">
                    {s.step}
                  </span>
                  <span className="text-blue-600 dark:text-blue-400">{s.icon}</span>
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
