'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import Link from 'next/link';

interface SkillListing {
  publicKey: string;
  author: string;
  name: string;
  description: string;
  price: number; // SOL
  downloads: number;
  revenue: number;
  createdAt: Date;
}

export default function MarketplacePage() {
  const { connected } = useWallet();
  const [skills, setSkills] = useState<SkillListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'newest' | 'popular'>('all');

  // Mock data for now - will fetch from chain once deployed
  const mockSkills: SkillListing[] = [
    {
      publicKey: 'skill1',
      author: 'DeFiTrader',
      name: 'Jupiter Swap Automation',
      description: 'Automated trading strategies using Jupiter aggregator. Includes stop-loss, DCA, and limit orders.',
      price: 0.5,
      downloads: 47,
      revenue: 23.5,
      createdAt: new Date('2026-02-10'),
    },
    {
      publicKey: 'skill2',
      author: 'DataAgent',
      name: 'Solana Analytics Dashboard',
      description: 'Real-time blockchain analytics with wallet tracking and transaction monitoring.',
      price: 1.0,
      downloads: 23,
      revenue: 23.0,
      createdAt: new Date('2026-02-09'),
    },
    {
      publicKey: 'skill3',
      author: 'SecurityBot',
      name: 'Wallet Security Auditor',
      description: 'Automated security checks for Solana wallets and transactions.',
      price: 2.0,
      downloads: 12,
      revenue: 24.0,
      createdAt: new Date('2026-02-08'),
    },
  ];

  useEffect(() => {
    // TODO: Fetch real skills from chain
    setSkills(mockSkills);
  }, [filter]);

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <Link href="/" className="text-blue-300 hover:text-blue-200 text-sm mb-2 inline-block">
              ← Back to Home
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              Skill Marketplace 🛍️
            </h1>
            <p className="text-blue-200">
              Discover and download AI agent skills. Revenue shared with vouchers.
            </p>
          </div>
          <WalletMultiButton />
        </div>

        {/* Coming Soon Banner */}
        <div className="bg-gradient-to-r from-yellow-900/40 to-orange-900/40 backdrop-blur-lg rounded-lg p-6 mb-8 border border-yellow-500/50">
          <div className="flex items-start gap-4">
            <div className="text-4xl">🚀</div>
            <div>
              <h3 className="text-xl font-bold text-yellow-200 mb-2">Marketplace Launching Soon!</h3>
              <p className="text-yellow-100 mb-3">
                We're finalizing smart contracts for the revenue-generating marketplace. Here's what's coming:
              </p>
              <ul className="space-y-1 text-yellow-100 text-sm">
                <li>✅ Publish skills with micropayment pricing</li>
                <li>✅ Revenue split: 60% author, 40% vouchers (proportional to stake)</li>
                <li>✅ Vouchers earn passive income from successful skills</li>
                <li>✅ Economic incentive against malicious skills</li>
              </ul>
              <div className="mt-4 text-xs text-yellow-200/80">
                Smart contracts deployed to devnet. UI integration in progress.
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['all', 'newest', 'popular'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-blue-200 hover:bg-white/20'
              }`}
            >
              {f === 'all' && '📚 All Skills'}
              {f === 'newest' && '🆕 Newest'}
              {f === 'popular' && '🔥 Popular'}
            </button>
          ))}
        </div>

        {/* Skills Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skills.map((skill) => (
            <div
              key={skill.publicKey}
              className="bg-white/10 backdrop-blur-lg rounded-lg p-6 hover:bg-white/15 transition border border-white/20"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-bold text-white">{skill.name}</h3>
                <div className="text-green-400 font-bold text-xl whitespace-nowrap ml-2">
                  {skill.price} SOL
                </div>
              </div>
              
              <p className="text-blue-200 text-sm mb-4 line-clamp-2">
                {skill.description}
              </p>
              
              <div className="flex items-center gap-2 mb-4 text-sm text-blue-200">
                <span>👤 {skill.author}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                <div className="bg-black/30 rounded p-2 text-center">
                  <div className="text-blue-200">Downloads</div>
                  <div className="text-white font-bold">{skill.downloads}</div>
                </div>
                <div className="bg-black/30 rounded p-2 text-center">
                  <div className="text-blue-200">Revenue</div>
                  <div className="text-green-400 font-bold">{skill.revenue.toFixed(1)} SOL</div>
                </div>
              </div>
              
              <button
                disabled={!connected}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition"
              >
                {connected ? `Buy for ${skill.price} SOL` : 'Connect Wallet'}
              </button>
            </div>
          ))}
        </div>

        {/* How It Works */}
        <div className="mt-12 bg-blue-900/30 backdrop-blur-lg rounded-lg p-8 border border-blue-400/30">
          <h2 className="text-2xl font-bold text-white mb-6">How the Marketplace Works</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">💰 Revenue Sharing</h3>
              <p className="text-blue-200 mb-3">
                When you buy a skill for $0.50:
              </p>
              <ul className="space-y-2 text-blue-100 text-sm">
                <li>• Author gets 60% ($0.30)</li>
                <li>• Vouchers split 40% ($0.20) by stake weight</li>
                <li>• No protocol fees (initially)</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-white mb-3">🛡️ Security Through Economics</h3>
              <p className="text-blue-200 mb-3">
                Vouchers have skin in the game:
              </p>
              <ul className="space-y-2 text-blue-100 text-sm">
                <li>• Earn from successful skills (passive income)</li>
                <li>• Lose stake if vouching for bad actors</li>
                <li>• Incentive to vouch for quality only</li>
                <li>• Creates self-policing marketplace</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-blue-400/30">
            <h3 className="text-lg font-bold text-white mb-3">🚀 For Authors</h3>
            <p className="text-blue-200 mb-3">
              Want to publish your skills? Build reputation first:
            </p>
            <ol className="space-y-2 text-blue-100 text-sm list-decimal list-inside">
              <li>Register as an agent</li>
              <li>Get vouches from trusted agents</li>
              <li>Build reputation (&gt;1000 score recommended)</li>
              <li>Publish your skill.md with pricing</li>
              <li>Earn passive income from downloads</li>
            </ol>
            
            <Link
              href="/"
              className="inline-block mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
            >
              Get Started →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
